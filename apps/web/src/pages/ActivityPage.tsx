import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ActivityLogEntry } from "../types";
import { formatTime } from "../utils/formatters";

export function ActivityPage() {
  const [activity, setActivity] = useState<readonly ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correlationFilter, setCorrelationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api.fetchActivity({ page, correlation_id: correlationFilter || undefined })
        .then(res => {
          setActivity(res.data);
          setTotalPages(res.total_pages);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }, 300); // Debounce fetch

    return () => clearTimeout(timer);
  }, [page, correlationFilter]);

  if (loading && activity.length === 0) return <div className="loading">Loading activity log...</div>;
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
          onChange={(e) => {
            setCorrelationFilter(e.target.value);
            setPage(1); // Reset to first page on filter
          }}
        />
      </div>
      {activity.length === 0 ? (
        <div className="detail-card">No activity found.</div>
      ) : (
        <>
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
                {activity.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {formatTime(entry.timestamp)}
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
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button 
                className="btn" 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button 
                className="btn" 
                disabled={page === totalPages} 
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}