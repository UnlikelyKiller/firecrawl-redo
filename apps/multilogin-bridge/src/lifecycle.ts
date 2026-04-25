import { URL } from "node:url";
import type { BridgeConfig } from "./config.js";
import type { SessionTarget } from "./types.js";

export interface LifecycleEndpoint {
  readonly source: "local" | "launcher";
  readonly baseUrl: string;
}

export interface FetchLike {
  (input: string | URL, init?: RequestInit): Promise<Response>;
}

function buildEndpointUrl(baseUrl: string, pathTemplate: string, profileId: string): string {
  const pathOrUrl = pathTemplate.replaceAll("{profileId}", encodeURIComponent(profileId));
  return new URL(pathOrUrl, baseUrl).toString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findStringValue(value: unknown, predicate: (candidate: string) => boolean): string | undefined {
  if (typeof value === "string") {
    return predicate(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findStringValue(entry, predicate);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  if (isObject(value)) {
    for (const entry of Object.values(value)) {
      const found = findStringValue(entry, predicate);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function deriveHttpUrlFromDebuggerAddress(value: string): string | undefined {
  if (!/^[^:]+:\d+$/.test(value)) {
    return undefined;
  }
  return `http://${value}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const rawText = await response.text();
    if (rawText.length === 0) {
      return undefined;
    }
    try {
      return JSON.parse(rawText) as unknown;
    } catch {
      return undefined;
    }
  }

  return response.json() as Promise<unknown>;
}

export class MultiloginLifecycleClient {
  constructor(
    private readonly config: BridgeConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getEndpoints().length > 0 || this.config.defaultCdpUrl);
  }

  async checkReachability(): Promise<boolean> {
    const endpoints = this.getEndpoints();
    if (endpoints.length === 0) {
      return Boolean(this.config.defaultCdpUrl);
    }

    for (const endpoint of endpoints) {
      try {
        const response = await this.fetchImpl(endpoint.baseUrl, {
          method: "GET",
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });
        if (response.status >= 100) {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  async startProfile(profileId: string): Promise<SessionTarget> {
    const startPath = this.config.lifecycle.startPath;
    const statusPath = this.config.lifecycle.statusPath;

    for (const endpoint of this.getEndpoints()) {
      let payload: unknown;
      if (startPath) {
        payload = await this.callEndpoint(endpoint, startPath, this.config.lifecycle.startMethod, profileId);
        const target = await this.resolveTargetFromPayload(endpoint, profileId, payload);
        if (target) {
          return target;
        }
      }

      if (statusPath) {
        payload = await this.callEndpoint(endpoint, statusPath, this.config.lifecycle.statusMethod, profileId);
        const target = await this.resolveTargetFromPayload(endpoint, profileId, payload);
        if (target) {
          return target;
        }
      }
    }

    if (this.config.defaultCdpUrl) {
      return {
        profileId,
        cdpHttpUrl: this.config.defaultCdpUrl,
        source: "env",
        startedByBridge: false,
      };
    }

    throw new Error(`Unable to resolve a CDP session target for profile ${profileId}`);
  }

  async stopProfile(profileId: string): Promise<void> {
    const stopPath = this.config.lifecycle.stopPath;
    if (!stopPath) {
      return;
    }

    for (const endpoint of this.getEndpoints()) {
      try {
        await this.callEndpoint(endpoint, stopPath, this.config.lifecycle.stopMethod, profileId);
        return;
      } catch {
        continue;
      }
    }
  }

  private getEndpoints(): LifecycleEndpoint[] {
    const endpoints: LifecycleEndpoint[] = [];
    if (this.config.lifecycle.localBaseUrl) {
      endpoints.push({ source: "local", baseUrl: this.config.lifecycle.localBaseUrl });
    }
    if (this.config.lifecycle.launcherBaseUrl) {
      endpoints.push({ source: "launcher", baseUrl: this.config.lifecycle.launcherBaseUrl });
    }
    return endpoints;
  }

  private async callEndpoint(
    endpoint: LifecycleEndpoint,
    pathTemplate: string,
    method: "GET" | "POST",
    profileId: string,
  ): Promise<unknown> {
    const url = buildEndpointUrl(endpoint.baseUrl, pathTemplate, profileId);
    const headers: Record<string, string> = {};
    if (this.config.lifecycle.apiToken) {
      headers.authorization = `Bearer ${this.config.lifecycle.apiToken}`;
    }
    if (method === "POST") {
      headers["content-type"] = "application/json";
    }

    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
    };
    if (method === "POST") {
      init.body = JSON.stringify({ profileId });
    }

    const response = await this.fetchImpl(url, init);
    if (!response.ok) {
      throw new Error(`Lifecycle request failed with HTTP ${response.status}`);
    }

    return parseJsonResponse(response);
  }

  private async resolveTargetFromPayload(
    endpoint: LifecycleEndpoint,
    profileId: string,
    payload: unknown,
  ): Promise<SessionTarget | undefined> {
    const cdpHttpUrl =
      findStringValue(payload, (value) => /^https?:\/\//i.test(value)) ??
      (() => {
        const debuggerAddress = findStringValue(payload, (value) => /^[^:]+:\d+$/.test(value));
        return debuggerAddress ? deriveHttpUrlFromDebuggerAddress(debuggerAddress) : undefined;
      })();
    const wsUrl = findStringValue(payload, (value) => /^wss?:\/\//i.test(value));

    let resolvedHttpUrl = cdpHttpUrl;
    let resolvedWsUrl = wsUrl;

    if (!resolvedWsUrl && resolvedHttpUrl) {
      resolvedWsUrl = await this.fetchWsDebuggerUrl(resolvedHttpUrl);
    }

    if (resolvedHttpUrl) {
      return {
        profileId,
        cdpHttpUrl: resolvedHttpUrl,
        ...(resolvedWsUrl ? { wsUrl: resolvedWsUrl } : {}),
        source: endpoint.source,
        startedByBridge: true,
        ...(isObject(payload) ? { metadata: payload } : {}),
      } satisfies SessionTarget;
    }

    return undefined;
  }

  private async fetchWsDebuggerUrl(cdpHttpUrl: string): Promise<string | undefined> {
    try {
      const response = await this.fetchImpl(new URL("/json/version", cdpHttpUrl), {
        method: "GET",
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
      if (!response.ok) {
        return undefined;
      }
      const payload = (await parseJsonResponse(response)) as Record<string, unknown> | undefined;
      const candidate = payload?.webSocketDebuggerUrl;
      return typeof candidate === "string" ? candidate : undefined;
    } catch {
      return undefined;
    }
  }
}

export const lifecycleInternals = {
  buildEndpointUrl,
  deriveHttpUrlFromDebuggerAddress,
  findStringValue,
};
