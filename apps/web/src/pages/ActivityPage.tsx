import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ActivityLogEntry } from "../types";

export function ActivityPage() {
  const [activity, setActivity] = useState<readonly ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correlationFilter, setCorrelationFilter] = useState("");

  useEffect(() => {
    api.fetchActivity()
      .then(res => {
        setActivity(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = activity.filter((entry) => {
    if (
      correlationFilter &&
      !entry.correlation_id.includes(correlationFilter)
    )
      return false;
    return true;
  });

  if (loading) return <div>Loading activity log...</div>;
  if (error) return <div className="error">Error: {error}</div>;

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