import { useState, useEffect } from "react";
import type { FailureGroup, EngineSuccessRate } from "../types";
import { api } from "../api/client";

export function FailuresPage() {
  const [groups, setGroups] = useState<readonly FailureGroup[]>([]);
  const [rates, setRates] = useState<readonly EngineSuccessRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.fetchFailureGroups(),
      api.fetchEngineSuccessRates()
    ])
      .then(([groupsRes, ratesRes]) => {
        setGroups(groupsRes);
        setRates(ratesRes);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading failures...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Failures</h1>
      </div>

      <div className="detail-card">
        <h3>Engine Success Rates</h3>
        {rates.map((er) => (
          <div key={er.engine} className="success-rate-bar">
            <span
              className="mono"
              style={{ minWidth: 100, fontSize: 12 }}
            >
              {er.engine}
            </span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${er.rate * 100}%`,
                  background:
                    er.rate >= 0.95
                      ? "var(--color-status-completed)"
                      : er.rate >= 0.9
                        ? "var(--color-status-queued)"
                        : "var(--color-status-failed)",
                }}
              />
            </div>
            <span className="bar-label">
              {(er.rate * 100).toFixed(1)}%
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                minWidth: 80,
              }}
            >
              {er.succeeded}/{er.total}
            </span>
          </div>
        ))}
      </div>

      <div className="detail-card">
        <h3>Failure Groups</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Error Class</th>
                <th>Count</th>
                <th>Domains</th>
                <th>Latest</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.error_class}>
                  <td className="mono">{g.error_class}</td>
                  <td>{g.count}</td>
                  <td>{g.domains.join(", ")}</td>
                  <td>{new Date(g.latest_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}