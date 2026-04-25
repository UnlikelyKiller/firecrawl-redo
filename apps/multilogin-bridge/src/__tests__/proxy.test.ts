import { describe, expect, it } from "vitest";
import { filterProxyHeaders, joinProxyPath } from "../proxy.js";

describe("proxy helpers", () => {
  it("joins proxy suffixes onto an upstream CDP URL", () => {
    expect(joinProxyPath("http://127.0.0.1:9222", "/json/list", "?discover=1"))
      .toBe("http://127.0.0.1:9222/json/list?discover=1");
    expect(joinProxyPath("http://127.0.0.1:9222/root", "", ""))
      .toBe("http://127.0.0.1:9222/root");
  });

  it("removes hop-by-hop headers before proxying", () => {
    expect(filterProxyHeaders({
      host: "bridge.local",
      connection: "keep-alive",
      authorization: "Bearer token",
      "content-type": "application/json",
    })).toEqual({
      authorization: "Bearer token",
      "content-type": "application/json",
    });
  });
});
