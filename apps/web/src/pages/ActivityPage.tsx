import { useState } from "react";
import type { ActivityLogEntry } from "../types";

const MOCK_ACTIVITY: readonly ActivityLogEntry[] = [
  {
    id: "act_001",
    timestamp: "2026-04-24T10:05:30Z",
    endpoint: "/v2/crawlx/jobs",
    method: "POST",
    correlation_id: "corr_a1b2c3",
    response_status: 201,
    latency_ms: 142,
  },
  {
    id: "act_002",
    timestamp: "2026-04-24T10:05:31Z",
    endpoint: "/v2/crawlx/jobs/job_01HXYZ001",
    method: "GET",
    correlation_id: "corr_d4e5f6",
    response_status: 200,
    latency_ms: 45,
  },
  {
    id: "act_003",
    timestamp: "2026-04-24T10:06:00Z",
    endpoint: "/v2/crawlx/pages",
    method: "GET",
    correlation_id: "corr_g7h8i9",
    response_status: 200,
    latency_ms: 89,
  },
  {
    id: "act_004",
    timestamp: "2026-04-24T10:06:30Z",
    endpoint: "/v2/crawlx/jobs/job_01HXYZ010",
    method: "GET",
    correlation_id: "corr_j0k1l2",
    response_status: 404,
    latency_ms: 12,
  },
  {
    id: "act_005",
    timestamp: "2026-04-24T10:07:00Z",
    endpoint: "/v2/crawlx/domains",
    method: "PATCH",
    correlation_id: "corr_m3n4o5",
    response_status: 200,
    latency_ms: 67,
  },
  {
    id: "act_006",
    timestamp: "2026-04-24T10:07:15Z",
    endpoint: "/v2/crawlx/jobs",
    method: "POST",
    correlation_id: "corr_a1b2c3",
    response_status: 500,
    latency_ms: 3200,
  },
];

export function ActivityPage() {
  const [correlationFilter, setCorrelationFilter] = useState("");

  const filtered = MOCK_ACTIVITY.filter((entry) => {
    if (
      correlationFilter &&
      !entry.correlation_id.includes(correlationFilter)
    )
      return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Activity Log</h1>
      </div>
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Filter by correlation ID..."
          value={correlationFilter}
          onChange={(e) => setCorrelationFilter(e.target.value)}
        />
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Correlation ID</th>
              <th>Status</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id}>
                <td className="mono" style={{ fontSize: 12 }}>
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
                <td>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        entry.method === "POST"
                          ? "var(--color-status-completed)"
                          : entry.method === "PATCH"
                            ? "var(--color-status-queued)"
                            : "var(--color-text-muted)",
                    }}
                  >
                    {entry.method}
                  </span>
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {entry.endpoint}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {entry.correlation_id}
                </td>
                <td>
                  <span
                    className={`badge badge--${
                      entry.response_status >= 400 ? "failed" : "completed"
                    }`}
                  >
                    {entry.response_status}
                  </span>
                </td>
                <td className="mono">
                  {entry.latency_ms >= 1000
                    ? `${(entry.latency_ms / 1000).toFixed(1)}s`
                    : `${entry.latency_ms}ms`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}