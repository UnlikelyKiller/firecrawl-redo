import { useState, useEffect } from "react";
import type { ScrapePage } from "../types";
import { api } from "../api/client";

function changeBadgeClass(
  indicator: ScrapePage["change_indicator"],
): string {
  if (indicator === "new") return "badge badge--running";
  if (indicator === "changed") return "badge badge--queued";
  return "badge badge--completed";
}

export function PagesPage() {
  const [pages, setPages] = useState<readonly ScrapePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchPages()
      .then(res => {
        setPages(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading pages...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pages</h1>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Content Hash</th>
              <th>Change</th>
              <th>Status</th>
              <th>Status Code</th>
              <th>Last Scraped</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id}>
                <td>{page.url}</td>
                <td className="mono" style={{ fontSize: 11 }}>
                  {page.content_hash}
                </td>
                <td>
                  {page.change_indicator ? (
                    <span className={changeBadgeClass(page.change_indicator)}>
                      {page.change_indicator}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <span
                    className={`badge badge--${
                      page.status === "failed" ? "failed" : "completed"
                    }`}
                  >
                    {page.status}
                  </span>
                </td>
                <td className="mono">{page.status_code ?? "-"}</td>
                <td>{new Date(page.last_scraped_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}