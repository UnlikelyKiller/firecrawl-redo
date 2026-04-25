import { describe, expect, it, vi } from "vitest";
import { buildLeaseProxyQuery, authorizeRequest, ReplayGuard } from "../auth.js";
import { loadConfig } from "../config.js";

describe("bridge auth", () => {
  it("builds a lease-scoped proxy query and accepts it for CDP paths", () => {
    const now = new Date("2026-04-25T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const config = loadConfig({
      MULTILOGIN_SHARED_SECRET: "bridge-secret",
    });
    const query = buildLeaseProxyQuery("lease-123", "2026-04-25T12:05:00.000Z", config);
    const req = {
      method: "GET",
      headers: {},
    } as const;

    expect(authorizeRequest(
      req,
      "",
      `/cdp/lease-123/json/version${query}`,
      config,
      new ReplayGuard(config.auth.replayWindowMs),
    )).toBe(true);

    vi.useRealTimers();
  });

  it("rejects expired lease-scoped proxy tokens", () => {
    const now = new Date("2026-04-25T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const config = loadConfig({
      MULTILOGIN_SHARED_SECRET: "bridge-secret",
    });
    const query = buildLeaseProxyQuery("lease-123", "2026-04-25T11:59:00.000Z", config);
    const req = {
      method: "GET",
      headers: {},
    } as const;

    expect(authorizeRequest(
      req,
      "",
      `/cdp/lease-123/ws${query}`,
      config,
      new ReplayGuard(config.auth.replayWindowMs),
    )).toBe(false);

    vi.useRealTimers();
  });

  it("does not allow unauthenticated access when the bridge is not loopback-only", () => {
    const config = loadConfig({
      HOST: "0.0.0.0",
      MULTILOGIN_PUBLIC_ORIGIN: "http://bridge.example.com",
    });
    const req = {
      method: "GET",
      headers: {},
    } as const;

    expect(authorizeRequest(
      req,
      "",
      "/health",
      config,
      new ReplayGuard(config.auth.replayWindowMs),
    )).toBe(false);
  });
});
