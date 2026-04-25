import { z } from "zod";
import type { CapabilityName, SessionCapabilities } from "./types.js";

const capabilityNames = [
  "screenshots",
  "ariaSnapshots",
  "har",
  "video",
  "tracing",
] as const satisfies ReadonlyArray<CapabilityName>;

export interface BridgeConfig {
  readonly version: string;
  readonly host: string;
  readonly port: number;
  publicOrigin?: string;
  sharedSecret?: string;
  readonly leaseTtlSeconds: number;
  readonly cleanupIntervalMs: number;
  readonly stopProfileOnRelease: boolean;
  readonly stopProfileOnExpiry: boolean;
  readonly requestTimeoutMs: number;
  readonly profileAllowlist: ReadonlySet<string>;
  readonly allowedCapabilities: SessionCapabilities;
  defaultCdpUrl?: string;
  readonly auth: {
    readonly maxSkewSeconds: number;
    readonly replayWindowMs: number;
  };
  readonly lifecycle: {
    localBaseUrl?: string;
    launcherBaseUrl?: string;
    apiToken?: string;
    startPath?: string;
    readonly startMethod: "GET" | "POST";
    stopPath?: string;
    readonly stopMethod: "GET" | "POST";
    statusPath?: string;
    readonly statusMethod: "GET" | "POST";
  };
}

const envSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(4000),
  MULTILOGIN_BRIDGE_VERSION: z.string().default("0.2.0"),
  MULTILOGIN_PUBLIC_ORIGIN: z.string().url().optional(),
  MULTILOGIN_SHARED_SECRET: z.string().min(1).optional(),
  MULTILOGIN_ATTACH_TTL_SECONDS: z.coerce.number().int().min(15).max(3600).default(900),
  MULTILOGIN_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(1000).max(300000).default(15000),
  MULTILOGIN_STOP_PROFILE_ON_RELEASE: z.coerce.boolean().default(true),
  MULTILOGIN_STOP_PROFILE_ON_EXPIRY: z.coerce.boolean().default(true),
  MULTILOGIN_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(500).max(120000).default(10000),
  MULTILOGIN_ALLOWED_PROFILES: z.string().optional(),
  MULTILOGIN_ALLOWED_CAPABILITIES: z.string().default("screenshots"),
  MULTILOGIN_CDP_URL: z.string().url().optional(),
  MULTILOGIN_AUTH_MAX_SKEW_SECONDS: z.coerce.number().int().min(5).max(300).default(60),
  MULTILOGIN_AUTH_REPLAY_WINDOW_MS: z.coerce.number().int().min(1000).max(600000).default(120000),
  MULTILOGIN_LOCAL_API_BASE_URL: z.string().url().optional(),
  MULTILOGIN_LAUNCHER_API_BASE_URL: z.string().url().optional(),
  MULTILOGIN_API_TOKEN: z.string().min(1).optional(),
  MULTILOGIN_START_PATH: z.string().optional(),
  MULTILOGIN_START_METHOD: z.enum(["GET", "POST"]).default("POST"),
  MULTILOGIN_STOP_PATH: z.string().optional(),
  MULTILOGIN_STOP_METHOD: z.enum(["GET", "POST"]).default("POST"),
  MULTILOGIN_STATUS_PATH: z.string().optional(),
  MULTILOGIN_STATUS_METHOD: z.enum(["GET", "POST"]).default("GET"),
});

function parseCsv(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseAllowedCapabilities(rawValue: string): SessionCapabilities {
  const selected = new Set(
    parseCsv(rawValue).filter((value): value is CapabilityName =>
      capabilityNames.includes(value as CapabilityName),
    ),
  );

  return {
    screenshots: selected.has("screenshots"),
    ariaSnapshots: selected.has("ariaSnapshots"),
    har: selected.has("har"),
    video: selected.has("video"),
    tracing: selected.has("tracing"),
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const parsed = envSchema.parse(env);

  const config: BridgeConfig = {
    version: parsed.MULTILOGIN_BRIDGE_VERSION,
    host: parsed.HOST,
    port: parsed.PORT,
    leaseTtlSeconds: parsed.MULTILOGIN_ATTACH_TTL_SECONDS,
    cleanupIntervalMs: parsed.MULTILOGIN_CLEANUP_INTERVAL_MS,
    stopProfileOnRelease: parsed.MULTILOGIN_STOP_PROFILE_ON_RELEASE,
    stopProfileOnExpiry: parsed.MULTILOGIN_STOP_PROFILE_ON_EXPIRY,
    requestTimeoutMs: parsed.MULTILOGIN_REQUEST_TIMEOUT_MS,
    profileAllowlist: new Set(parseCsv(parsed.MULTILOGIN_ALLOWED_PROFILES)),
    allowedCapabilities: parseAllowedCapabilities(parsed.MULTILOGIN_ALLOWED_CAPABILITIES),
    auth: {
      maxSkewSeconds: parsed.MULTILOGIN_AUTH_MAX_SKEW_SECONDS,
      replayWindowMs: parsed.MULTILOGIN_AUTH_REPLAY_WINDOW_MS,
    },
    lifecycle: {
      startMethod: parsed.MULTILOGIN_START_METHOD,
      stopMethod: parsed.MULTILOGIN_STOP_METHOD,
      statusMethod: parsed.MULTILOGIN_STATUS_METHOD,
    },
  };

  if (parsed.MULTILOGIN_PUBLIC_ORIGIN) {
    config.publicOrigin = parsed.MULTILOGIN_PUBLIC_ORIGIN;
  }
  if (parsed.MULTILOGIN_SHARED_SECRET) {
    config.sharedSecret = parsed.MULTILOGIN_SHARED_SECRET;
  }
  if (parsed.MULTILOGIN_CDP_URL) {
    config.defaultCdpUrl = parsed.MULTILOGIN_CDP_URL;
  }
  if (parsed.MULTILOGIN_LOCAL_API_BASE_URL) {
    config.lifecycle.localBaseUrl = parsed.MULTILOGIN_LOCAL_API_BASE_URL;
  }
  if (parsed.MULTILOGIN_LAUNCHER_API_BASE_URL) {
    config.lifecycle.launcherBaseUrl = parsed.MULTILOGIN_LAUNCHER_API_BASE_URL;
  }
  if (parsed.MULTILOGIN_API_TOKEN) {
    config.lifecycle.apiToken = parsed.MULTILOGIN_API_TOKEN;
  }
  if (parsed.MULTILOGIN_START_PATH) {
    config.lifecycle.startPath = parsed.MULTILOGIN_START_PATH;
  }
  if (parsed.MULTILOGIN_STOP_PATH) {
    config.lifecycle.stopPath = parsed.MULTILOGIN_STOP_PATH;
  }
  if (parsed.MULTILOGIN_STATUS_PATH) {
    config.lifecycle.statusPath = parsed.MULTILOGIN_STATUS_PATH;
  }

  return config;
}

export function isProfileAllowed(config: BridgeConfig, profileId: string): boolean {
  return config.profileAllowlist.size === 0 || config.profileAllowlist.has(profileId);
}
