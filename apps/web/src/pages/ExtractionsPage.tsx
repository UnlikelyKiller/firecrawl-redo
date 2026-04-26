import { useEffect, useState } from "react";
import type { Extraction, ExtractionStatus } from "../types";
import { api } from "../api/client";
import { formatTime } from "../utils/formatters";

function extractionBadgeClass(status: ExtractionStatus): string {
  return `badge badge--${status}`;
}

export function ExtractionsPage() {
  const [extractions, setExtractions] = useState<readonly Extraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.fetchExtractions({ page })
      .then(res => {
        setExtractions(res.data);
        setTotalPages(res.total_pages);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [page]);

  if (loading) return <div className="loading">Loading extractions...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (extractions.length === 0) return <div className="detail-card">No extractions found.</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Extractions</h1>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Job ID</th>
              <th>Schema</th>
              <th>Status</th>
              <th>Confidence</th>
              <th>Validation Errors</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {extractions.map((ext) => (
              <tr key={ext.id}>
                <td className="mono">{ext.id}</td>
                <td className="mono">{ext.job_id}</td>
                <td className="mono">{ext.schema_id}</td>
                <td>
                  <span className={extractionBadgeClass(ext.status)}>
                    {ext.status}
                  </span>
                </td>
                <td className="mono">
                  {ext.status === "pending"
                    ? "-"
                    : `${(ext.confidence * 100).toFixed(1)}%`}
                </td>
                <td>
                  {ext.validation_errors && ext.validation_errors.length > 0
                    ? ext.validation_errors.join("; ")
                    : "-"}
                </td>
                <td>{formatTime(ext.created_at)}</td>
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