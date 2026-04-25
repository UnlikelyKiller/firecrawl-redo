import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import { MultiloginLifecycleClient, lifecycleInternals } from "../lifecycle.js";

describe("MultiloginLifecycleClient", () => {
  it("builds lifecycle endpoint URLs from templates", () => {
    const url = lifecycleInternals.buildEndpointUrl(
      "http://127.0.0.1:35000/",
      "/api/profile/{profileId}/start",
      "profile-123",
    );

    expect(url).toBe("http://127.0.0.1:35000/api/profile/profile-123/start");
  });

  it("derives a session target from a lifecycle response and json/version lookup", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const value = input.toString();
      if (value.includes("/start")) {
        return new Response(JSON.stringify({ debuggerAddress: "127.0.0.1:9222" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (value.endsWith("/json/version")) {
        return new Response(JSON.stringify({
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc",
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const config = loadConfig({
      MULTILOGIN_LOCAL_API_BASE_URL: "http://127.0.0.1:35000",
      MULTILOGIN_START_PATH: "/api/profile/{profileId}/start",
    });
    const client = new MultiloginLifecycleClient(config, fetchMock);

    const target = await client.startProfile("profile-123");

    expect(target).toMatchObject({
      profileId: "profile-123",
      cdpHttpUrl: "http://127.0.0.1:9222",
      wsUrl: "ws://127.0.0.1:9222/devtools/browser/abc",
      source: "local",
      startedByBridge: true,
    });
  });

  it("falls back to the configured default CDP URL", async () => {
    const config = loadConfig({
      MULTILOGIN_CDP_URL: "http://127.0.0.1:9222",
    });
    const client = new MultiloginLifecycleClient(config, vi.fn());

    const target = await client.startProfile("profile-123");

    expect(target).toMatchObject({
      profileId: "profile-123",
      cdpHttpUrl: "http://127.0.0.1:9222",
      source: "env",
      startedByBridge: false,
    });
  });
});
