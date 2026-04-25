import { jest } from "@jest/globals";

const whereMock: any = jest.fn();
const fromMock = jest.fn(() => ({
  where: whereMock,
}));
const selectMock = jest.fn(() => ({
  from: fromMock,
}));

jest.mock("../../../lib/db", () => ({
  db: {
    select: selectMock,
  },
}));

jest.mock("../../../config", () => ({
  config: {
    MULTILOGIN_ENABLED: true,
    MULTILOGIN_BRIDGE_URL: "http://bridge.local",
    MULTILOGIN_TOKEN: "secret",
    MULTILOGIN_PROFILE_ID: "profile-123",
  },
}));

jest.mock("@crawlx/db", () => ({
  domainPolicies: {
    domain: "domain",
    browserMode: "browser_mode",
    sessionBackend: "session_backend",
    requiresNamedProfile: "requires_named_profile",
  },
  browserProfiles: {
    domain: "domain",
    backend: "backend",
    externalProfileId: "external_profile_id",
  },
}));

import { resolveMultiloginRoutePolicy } from "./multilogin";

describe("resolveMultiloginRoutePolicy", () => {
  beforeEach(() => {
    whereMock.mockReset();
    fromMock.mockClear();
    selectMock.mockClear();
  });

  it("returns an eligible named-profile policy when domain and browser profile match", async () => {
    (whereMock as any)
      .mockResolvedValueOnce([
        {
          domain: "example.com",
          browserMode: "multilogin_required",
          sessionBackend: "multilogin",
          requiresNamedProfile: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          domain: "example.com",
          backend: "multilogin",
          externalProfileId: "profile-123",
        },
      ]);

    const result = await resolveMultiloginRoutePolicy(
      "https://app.example.com/dashboard",
    );

    expect(result).toEqual({
      eligible: true,
      required: true,
      requiresNamedProfile: true,
      allowedDomains: ["example.com"],
      profileId: "profile-123",
    });
    expect(selectMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a named profile is required but no matching browser_profiles binding exists", async () => {
    (whereMock as any)
      .mockResolvedValueOnce([
        {
          domain: "example.com",
          browserMode: "multilogin_required",
          sessionBackend: "multilogin",
          requiresNamedProfile: true,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await resolveMultiloginRoutePolicy(
      "https://example.com/private",
    );

    expect(result).toMatchObject({
      eligible: false,
      required: true,
      requiresNamedProfile: true,
      allowedDomains: ["example.com"],
    });
    expect(result.error).toContain("browser_profiles");
  });
});
