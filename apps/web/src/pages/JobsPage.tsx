import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../api/client";
import type { Job, JobStatus } from "../types";

function statusBadgeClass(status: JobStatus): string {
  switch (status) {
    case "completed":
      return "badge badge--completed";
    case "failed":
      return "badge badge--failed";
    case "active":
      return "badge badge--queued";
    default:
      return "badge";
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function JobsPage() {
  const [jobs, setJobs] = useState<readonly Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchJobs()
      .then(res => {
        setJobs(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading jobs...</div>;
  if (error) return <div className="error">Error: {error}</div>;

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
    </div>
  );
}
