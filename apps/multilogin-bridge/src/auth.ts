import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { BridgeConfig } from "./config.js";

interface CachedNonce {
  readonly expiresAt: number;
}

export class ReplayGuard {
  private readonly cache = new Map<string, CachedNonce>();

  constructor(private readonly replayWindowMs: number) {}

  has(key: string, now = Date.now()): boolean {
    this.prune(now);
    const cached = this.cache.get(key);
    return cached !== undefined && cached.expiresAt > now;
  }

  remember(key: string, now = Date.now()): void {
    this.prune(now);
    this.cache.set(key, { expiresAt: now + this.replayWindowMs });
  }

  private prune(now: number): void {
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isLoopbackHost(host: string | undefined): boolean {
  if (!host) {
    return false;
  }

  const normalized = host.toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

function allowsInsecureLocalOnly(config: BridgeConfig): boolean {
  if (!isLoopbackHost(config.host)) {
    return false;
  }

  if (!config.publicOrigin) {
    return true;
  }

  try {
    return isLoopbackHost(new URL(config.publicOrigin).hostname);
  } catch {
    return false;
  }
}

function encodeProxyToken(leaseId: string, expiresAt: string, secret: string): string {
  return createHmac("sha256", secret).update(`${leaseId}\n${expiresAt}`).digest("hex");
}

function extractLeaseId(pathName: string): string | null {
  const match = pathName.match(/^\/cdp\/([^/]+)/);
  return match?.[1] ?? null;
}

function getQueryParam(pathWithQuery: string, name: string): string | undefined {
  try {
    const value = new URL(`http://bridge.local${pathWithQuery}`).searchParams.get(name);
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

function authorizeLeaseProxyRequest(
  pathWithQuery: string,
  config: BridgeConfig,
): boolean {
  const secret = config.sharedSecret;
  if (!secret) {
    return true;
  }

  const pathName = pathWithQuery.split("?")[0] ?? pathWithQuery;
  const leaseId = extractLeaseId(pathName);
  const expiresAt = getQueryParam(pathWithQuery, "bridge_expires");
  const token = getQueryParam(pathWithQuery, "bridge_token");
  if (!leaseId || !expiresAt || !token) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return false;
  }

  return safeCompare(token, encodeProxyToken(leaseId, expiresAt, secret));
}

export function buildLeaseProxyQuery(
  leaseId: string,
  expiresAt: string,
  config: BridgeConfig,
): string {
  if (!config.sharedSecret) {
    return "";
  }

  const params = new URLSearchParams({
    bridge_expires: expiresAt,
    bridge_token: encodeProxyToken(leaseId, expiresAt, config.sharedSecret),
  });
  return `?${params.toString()}`;
}

export function authorizeRequest(
  req: IncomingMessage,
  rawBody: string,
  pathWithQuery: string,
  config: BridgeConfig,
  replayGuard: ReplayGuard,
): boolean {
  const secret = config.sharedSecret;
  if (!secret) {
    return allowsInsecureLocalOnly(config);
  }

  if (pathWithQuery.startsWith("/cdp/") && authorizeLeaseProxyRequest(pathWithQuery, config)) {
    return true;
  }

  const headerSecret = getHeader(req, "x-bridge-secret");
  if (headerSecret && safeCompare(headerSecret, secret)) {
    return true;
  }

  const timestamp = getHeader(req, "x-bridge-timestamp");
  const nonce = getHeader(req, "x-bridge-nonce");
  const signature = getHeader(req, "x-bridge-signature");
  if (!timestamp || !nonce || !signature) {
    return false;
  }

  const timestampMs = Number(timestamp);
  const now = Date.now();
  if (!Number.isFinite(timestampMs)) {
    return false;
  }

  const maxSkewMs = config.auth.maxSkewSeconds * 1000;
  if (Math.abs(now - timestampMs) > maxSkewMs) {
    return false;
  }

  const replayKey = `${timestamp}:${nonce}`;
  if (replayGuard.has(replayKey, now)) {
    return false;
  }

  const payload = [
    req.method ?? "GET",
    pathWithQuery,
    timestamp,
    nonce,
    rawBody,
  ].join("\n");
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (!safeCompare(expected, signature)) {
    return false;
  }

  replayGuard.remember(replayKey, now);
  return true;
}
