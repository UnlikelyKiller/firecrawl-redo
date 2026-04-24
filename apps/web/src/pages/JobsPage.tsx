import { useState } from "react";
import { Link } from "react-router";
import type { Job, JobStatus } from "../types";

const MOCK_JOBS: readonly Job[] = [
  {
    id: "job_01HXYZ001",
    seed_url: "https://example.com",
    job_type: "crawl",
    status: "COMPLETED",
    created_at: "2026-04-24T10:00:00Z",
    started_at: "2026-04-24T10:00:02Z",
    completed_at: "2026-04-24T10:05:30Z",
    engine: "fire-engine",
    pages_scraped: 142,
    cost_cents: 284,
  },
  {
    id: "job_01HXYZ002",
    seed_url: "https://docs.python.org/3/",
    job_type: "scrape",
    status: "RUNNING",
    created_at: "2026-04-24T10:10:00Z",
    started_at: "2026-04-24T10:10:01Z",
    engine: "cheerio",
    pages_scraped: 1,
  },
  {
    id: "job_01HXYZ003",
    seed_url: "https://news.ycombinator.com",
    job_type: "map",
    status: "QUEUED",
    created_at: "2026-04-24T10:15:00Z",
    pages_scraped: 0,
  },
  {
    id: "job_01HXYZ004",
    seed_url: "https://shop.example.com/products",
    job_type: "extract",
    status: "FAILED",
    created_at: "2026-04-24T09:30:00Z",
    started_at: "2026-04-24T09:30:01Z",
    completed_at: "2026-04-24T09:30:45Z",
    engine: "puppeteer",
    pages_scraped: 3,
    error_message: "Navigation timeout after 30000ms",
    cost_cents: 90,
  },
  {
    id: "job_01HXYZ005",
    seed_url: "https://blog.example.com",
    job_type: "crawl",
    status: "CANCELLED",
    created_at: "2026-04-24T08:00:00Z",
    pages_scraped: 0,
  },
];

const STATUS_OPTIONS: readonly JobStatus[] = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

function statusBadgeClass(status: JobStatus): string {
  return `badge badge--${status.toLowerCase()}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const filtered = MOCK_JOBS.filter((job) => {
    if (statusFilter && job.status !== statusFilter) return false;
    if (search && !job.seed_url.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Jobs</h1>
      </div>
      <div className="filter-bar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search by URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>URL</th>
              <th>Type</th>
              <th>Status</th>
              <th>Engine</th>
              <th>Pages</th>
              <th>Cost</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <tr key={job.id}>
                <td>
                  <Link to={`/jobs/${job.id}`} className="mono">
                    {job.id}
                  </Link>
                </td>
                <td>{job.seed_url}</td>
                <td>{job.job_type}</td>
                <td>
                  <span className={statusBadgeClass(job.status)}>
                    {job.status}
                  </span>
                </td>
                <td>{job.engine ?? "-"}</td>
                <td>{job.pages_scraped}</td>
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