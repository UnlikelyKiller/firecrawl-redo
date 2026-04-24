import type { FailureGroup, EngineSuccessRate } from "../types";

const MOCK_GROUPS: readonly FailureGroup[] = [
  {
    error_class: "NavigationTimeout",
    count: 47,
    domains: ["example.com", "slow-site.org"],
    latest_at: "2026-04-24T10:05:00Z",
  },
  {
    error_class: "SSLCertError",
    count: 12,
    domains: ["self-signed.dev"],
    latest_at: "2026-04-24T09:30:00Z",
  },
  {
    error_class: "ContentExceededMaxLength",
    count: 8,
    domains: ["large-page.com", "data-dump.io"],
    latest_at: "2026-04-24T08:15:00Z",
  },
  {
    error_class: "DnsResolutionFailed",
    count: 3,
    domains: ["nonexistent.example"],
    latest_at: "2026-04-24T07:00:00Z",
  },
];

const MOCK_ENGINE_RATES: readonly EngineSuccessRate[] = [
  { engine: "fire-engine", total: 500, succeeded: 485, rate: 0.97 },
  { engine: "cheerio", total: 1200, succeeded: 1140, rate: 0.95 },
  { engine: "puppeteer", total: 300, succeeded: 270, rate: 0.9 },
  { engine: "playwright", total: 200, succeeded: 170, rate: 0.85 },
];

export function FailuresPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Failures</h1>
      </div>

      <div className="detail-card">
        <h3>Engine Success Rates</h3>
        {MOCK_ENGINE_RATES.map((er) => (
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
              {MOCK_GROUPS.map((g) => (
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