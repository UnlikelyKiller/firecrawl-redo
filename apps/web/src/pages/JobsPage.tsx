import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../api/client";
import type { Job, JobStatus } from "../types";
import { formatTime } from "../utils/formatters";

function statusBadgeClass(status: JobStatus): string {
  switch (status) {
    case "COMPLETED":
      return "badge badge--completed";
    case "FAILED":
      return "badge badge--failed";
    case "QUEUED":
    case "RUNNING":
      return "badge badge--queued";
    default:
      return "badge";
  }
}

export function JobsPage() {
  const [jobs, setJobs] = useState<readonly Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.fetchJobs({ page })
      .then(res => {
        setJobs(res.data);
        setTotalPages(res.total_pages);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [page]);

  if (loading) return <div className="loading">Loading jobs...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (jobs.length === 0) return <div className="detail-card">No jobs found.</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Durable Jobs</h1>
        <div className="page-actions">
          <button className="button button--primary">New Job</button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Type</th>
              <th>Seed URL</th>
              <th>Cost</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="mono">
                  <Link to={`/jobs/${job.id}`}>{job.id.slice(0, 12)}...</Link>
                </td>
                <td>
                  <span className={statusBadgeClass(job.status)}>
                    {job.status}
                  </span>
                </td>
                <td className="mono small">{job.job_type}</td>
                <td className="truncate" style={{ maxWidth: 300 }}>
                  {job.seed_url}
                </td>
                <td className="mono">
                  {job.cost_cents !== undefined
                    ? `$${(job.cost_cents / 100).toFixed(2)}`
                    : "-"}
                </td>
                <td>{formatTime(job.created_at)}</td>
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
