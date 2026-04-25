import { and, eq, inArray } from "drizzle-orm";
import { browserProfiles, domainPolicies } from "@crawlx/db";
import { db } from "../../../lib/db";
import { config } from "../../../config";

export interface MultiloginRoutePolicy {
  readonly eligible: boolean;
  readonly required: boolean;
  readonly requiresNamedProfile: boolean;
  readonly allowedDomains: ReadonlyArray<string>;
  readonly profileId?: string;
  readonly error?: string;
}

function getDomainCandidates(hostname: string): string[] {
  const parts = hostname.toLowerCase().split(".");
  const candidates: string[] = [];

  for (let index = 0; index < parts.length - 1; index += 1) {
    candidates.push(parts.slice(index).join("."));
  }

  return candidates;
}

export async function resolveMultiloginRoutePolicy(
  urlString: string,
): Promise<MultiloginRoutePolicy> {
  let hostname: string;
  try {
    hostname = new URL(urlString).hostname.toLowerCase();
  } catch {
    return {
      eligible: false,
      required: false,
      requiresNamedProfile: false,
      allowedDomains: [],
      error: "Invalid URL",
    };
  }

  const candidates = getDomainCandidates(hostname);
  const rows = await db
    .select()
    .from(domainPolicies)
    .where(inArray(domainPolicies.domain, candidates));

  const policy = rows.sort(
    (left, right) => right.domain.length - left.domain.length,
  )[0];
  if (!policy) {
    return {
      eligible: false,
      required: false,
      requiresNamedProfile: false,
      allowedDomains: [],
    };
  }

  const required =
    policy.browserMode === "multilogin_required" ||
    policy.sessionBackend === "multilogin";
  const eligible = required && config.MULTILOGIN_ENABLED === true;
  const profileId = config.MULTILOGIN_PROFILE_ID;
  const requiresNamedProfile = policy.requiresNamedProfile ?? false;
  const matchingProfiles = profileId
    ? await db
        .select()
        .from(browserProfiles)
        .where(
          and(
            inArray(browserProfiles.domain, candidates),
            eq(browserProfiles.backend, "multilogin"),
            eq(browserProfiles.externalProfileId, profileId),
          ),
        )
    : [];
  const namedProfile = matchingProfiles.sort(
    (left, right) => right.domain.length - left.domain.length,
  )[0];

  if (required && !config.MULTILOGIN_ENABLED) {
    return {
      eligible: false,
      required: true,
      requiresNamedProfile,
      allowedDomains: [policy.domain],
      error: `Domain ${policy.domain} requires Multilogin, but MULTILOGIN_ENABLED is false`,
    };
  }

  if (required && (!config.MULTILOGIN_BRIDGE_URL || !config.MULTILOGIN_TOKEN)) {
    return {
      eligible: false,
      required: true,
      requiresNamedProfile,
      allowedDomains: [policy.domain],
      error: `Domain ${policy.domain} requires Multilogin, but bridge configuration is incomplete`,
    };
  }

  if (requiresNamedProfile && !profileId) {
    return {
      eligible: false,
      required: true,
      requiresNamedProfile,
      allowedDomains: [policy.domain],
      error: `Domain ${policy.domain} requires a named Multilogin profile, but no profile is configured`,
    };
  }

  if (requiresNamedProfile && !namedProfile) {
    return {
      eligible: false,
      required: true,
      requiresNamedProfile,
      allowedDomains: [policy.domain],
      error: `Domain ${policy.domain} requires a named Multilogin profile bound in browser_profiles, but no matching profile was found`,
    };
  }

  return {
    eligible,
    required,
    requiresNamedProfile,
    allowedDomains: required ? [namedProfile?.domain ?? policy.domain] : [],
    profileId: namedProfile?.externalProfileId ?? profileId,
  };
}
