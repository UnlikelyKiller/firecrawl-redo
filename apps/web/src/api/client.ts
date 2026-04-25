import type {
  JobsResponse,
  PagesResponse,
  FailuresResponse,
  FailureGroup,
  EngineSuccessRate,
  DomainPolicy,
  ExtractionsResponse,
  ActivityResponse,
  UsageResponse,
  ReceiptsResponse,
  JobDetail,
  Job,
} from "../types";

const API_BASE: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3002";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function withQuery(
  base: string,
  params?: Record<string, string | number | undefined>,
): string {
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export const api = {
  fetchJobs(params?: {
    readonly status?: string;
    readonly page?: number;
    readonly per_page?: number;
    readonly search?: string;
  }): Promise<JobsResponse> {
    return request<JobsResponse>(
      withQuery("/v2/crawlx/jobs", params as Record<string, string | number | undefined> | undefined),
    );
  },

  fetchJob(jobId: string): Promise<JobDetail> {
    return request<JobDetail>(`/v2/crawlx/jobs/${jobId}`);
  },

  async replayJob(jobId: string): Promise<Job> {
    const res = await request<{ success: boolean; data: Job }>(
      `/v2/crawlx/jobs/${jobId}/replay`, { method: "POST" },
    );
    return res.data;
  },

  fetchPages(params?: {
    readonly page?: number;
    readonly per_page?: number;
  }): Promise<PagesResponse> {
    return request<PagesResponse>(
      withQuery("/v2/crawlx/pages", params as Record<string, string | number | undefined> | undefined),
    );
  },

  fetchFailures(params?: {
    readonly page?: number;
    readonly per_page?: number;
  }): Promise<FailuresResponse> {
    return request<FailuresResponse>(
      withQuery("/v2/crawlx/failures", params as Record<string, string | number | undefined> | undefined),
    );
  },

  fetchFailureGroups(): Promise<readonly FailureGroup[]> {
    return request<readonly FailureGroup[]>("/v2/crawlx/failures/groups");
  },

  fetchEngineSuccessRates(): Promise<readonly EngineSuccessRate[]> {
    return request<readonly EngineSuccessRate[]>(
      "/v2/crawlx/failures/engines",
    );
  },

  fetchDomainPolicies(): Promise<readonly DomainPolicy[]> {
    return request<readonly DomainPolicy[]>("/v2/crawlx/domains");
  },

  createDomainPolicy(
    policy: Omit<DomainPolicy, "created_at" | "updated_at">,
  ): Promise<DomainPolicy> {
    return request<DomainPolicy>("/v2/crawlx/domains", {
      method: "POST",
      body: JSON.stringify(policy),
    });
  },

  updateDomainPolicy(
    domain: string,
    policy: Partial<Omit<DomainPolicy, "domain" | "created_at" | "updated_at">>,
  ): Promise<DomainPolicy> {
    return request<DomainPolicy>(`/v2/crawlx/domains/${domain}`, {
      method: "PATCH",
      body: JSON.stringify(policy),
    });
  },

  fetchExtractions(params?: {
    readonly page?: number;
    readonly per_page?: number;
  }): Promise<ExtractionsResponse> {
    return request<ExtractionsResponse>(
      withQuery("/v2/crawlx/extractions", params as Record<string, string | number | undefined> | undefined),
    );
  },

  fetchActivity(params?: {
    readonly page?: number;
    readonly per_page?: number;
    readonly correlation_id?: string;
  }): Promise<ActivityResponse> {
    return request<ActivityResponse>(
      withQuery("/v2/crawlx/activity", params as Record<string, string | number | undefined> | undefined),
    );
  },

  fetchUsage(params?: {
    readonly from?: string;
    readonly to?: string;
  }): Promise<UsageResponse> {
    return request<UsageResponse>(
      withQuery("/v2/crawlx/usage", params as Record<string, string | number | undefined> | undefined),
    );
  },

  fetchReceipts(params?: {
    readonly page?: number;
    readonly per_page?: number;
    readonly job_id?: string;
  }): Promise<ReceiptsResponse> {
    return request<ReceiptsResponse>(
      withQuery("/v2/crawlx/receipts", params as Record<string, string | number | undefined> | undefined),
    );
  },
};