import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { UsageEntry } from "../types";
import { formatTokens, formatCurrency } from "../utils/formatters";

export function UsagePage() {
  const [usage, setUsage] = useState<readonly UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchUsage()
      .then(res => {
        setUsage(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading usage data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  if (usage.length === 0) return <div className="detail-card">No usage data found.</div>;

  const totals = usage.reduce(
    (acc, entry) => ({
      llm_tokens: acc.llm_tokens + entry.llm_tokens,
      browser_seconds: acc.browser_seconds + entry.browser_seconds,
      pages_scraped: acc.pages_scraped + entry.pages_scraped,
      cost_cents: acc.cost_cents + entry.cost_cents,
    }),
    { llm_tokens: 0, browser_seconds: 0, pages_scraped: 0, cost_cents: 0 },
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Usage</h1>
      </div>

      <div className="detail-card">
        <h3>System Totals</h3>
        <div className="detail-grid">
          <div className="detail-field">
            <label>LLM Tokens</label>
            <span className="mono" style={{ fontSize: 18 }}>
              {formatTokens(totals.llm_tokens)}
            </span>
          </div>
          <div className="detail-field">
            <label>Browser Time</label>
            <span className="mono" style={{ fontSize: 18 }}>
              {(totals.browser_seconds / 60).toFixed(1)} min
            </span>
          </div>
          <div className="detail-field">
            <label>Pages Scraped</label>
            <span className="mono" style={{ fontSize: 18 }}>
              {totals.pages_scraped.toLocaleString()}
            </span>
          </div>
          <div className="detail-field">
            <label>Estimated Cost</label>
            <span className="mono" style={{ fontSize: 18 }}>
              {formatCurrency(totals.cost_cents)}
            </span>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>LLM Tokens</th>
              <th>Browser Seconds</th>
              <th>Pages Scraped</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((entry) => (
              <tr key={entry.date}>
                <td>{entry.date}</td>
                <td className="mono">
                  {formatTokens(entry.llm_tokens)}
                </td>
                <td className="mono">{entry.browser_seconds}s</td>
                <td className="mono">
                  {entry.pages_scraped.toLocaleString()}
                </td>
                <td className="mono">
                  {formatCurrency(entry.cost_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}