import type { UsageEntry } from "../types";

const MOCK_USAGE: readonly UsageEntry[] = [
  {
    date: "2026-04-18",
    llm_tokens: 45000,
    browser_seconds: 120,
    pages_scraped: 340,
    cost_cents: 450,
  },
  {
    date: "2026-04-19",
    llm_tokens: 38000,
    browser_seconds: 95,
    pages_scraped: 280,
    cost_cents: 380,
  },
  {
    date: "2026-04-20",
    llm_tokens: 62000,
    browser_seconds: 200,
    pages_scraped: 510,
    cost_cents: 680,
  },
  {
    date: "2026-04-21",
    llm_tokens: 29000,
    browser_seconds: 70,
    pages_scraped: 190,
    cost_cents: 260,
  },
  {
    date: "2026-04-22",
    llm_tokens: 51000,
    browser_seconds: 150,
    pages_scraped: 420,
    cost_cents: 560,
  },
  {
    date: "2026-04-23",
    llm_tokens: 73000,
    browser_seconds: 240,
    pages_scraped: 580,
    cost_cents: 810,
  },
  {
    date: "2026-04-24",
    llm_tokens: 42000,
    browser_seconds: 110,
    pages_scraped: 310,
    cost_cents: 420,
  },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UsagePage() {
  const totals = MOCK_USAGE.reduce(
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
        <h3>7-Day Totals</h3>
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
              ${(totals.cost_cents / 100).toFixed(2)}
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
            {MOCK_USAGE.map((entry) => (
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
                  ${(entry.cost_cents / 100).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}