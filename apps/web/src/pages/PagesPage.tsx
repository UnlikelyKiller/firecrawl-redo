import { useState, useEffect } from "react";
import type { ScrapePage } from "../types";
import { api } from "../api/client";
import { formatTime } from "../utils/formatters";

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.fetchPages({ page })
      .then(res => {
        setPages(res.data);
        setTotalPages(res.total_pages);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [page]);

  if (loading) return <div className="loading">Loading pages...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (pages.length === 0) return <div className="detail-card">No pages found.</div>;

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
                <td>{formatTime(page.last_scraped_at)}</td>
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
    </div>
  );
}