import { useParams, Link } from "react-router";
import type { JobDetail, WaterfallStep, Artifact, JobStatus } from "../types";

const MOCK_DETAIL: JobDetail = {
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
  waterfall: [
    {
      engine: "cheerio",
      started_at: "2026-04-24T10:00:02Z",
      completed_at: "2026-04-24T10:00:03Z",
      status: "failed",
      error_message: "JavaScript rendering required",
      attempt: 1,
    },
    {
      engine: "fire-engine",
      started_at: "2026-04-24T10:00:04Z",
      completed_at: "2026-04-24T10:05:28Z",
      status: "success",
      attempt: 2,
    },
  ],
  artifacts: [
    {
      content_hash: "sha256:a1b2c3d4e5f6",
      content_type: "html",
      size_bytes: 48200,
      created_at: "2026-04-24T10:01:00Z",
    },
    {
      content_hash: "sha256:b2c3d4e5f6a7",
      content_type: "markdown",
      size_bytes: 12100,
      created_at: "2026-04-24T10:01:01Z",
    },
    {
      content_hash: "sha256:c3d4e5f6a7b8",
      content_type: "screenshot",
      size_bytes: 245000,
      created_at: "2026-04-24T10:01:02Z",
    },
  ],
  extraction: {
    schema_id: "product_schema_v2",
    status: "completed",
    confidence: 0.94,
    extracted_at: "2026-04-24T10:03:00Z",
  },
  llm_calls: [
    {
      id: "llm_001",
      model: "gpt-4o-mini",
      prompt_tokens: 1200,
      completion_tokens: 800,
      cost_cents: 3,
      created_at: "2026-04-24T10:02:00Z",
    },
  ],
};

function statusBadgeClass(status: JobStatus): string {
  return `badge badge--${status.toLowerCase()}`;
}

function stepStatusClass(status: WaterfallStep["status"]): string {
  return `step-number step-number--${status}`;
}

function waterfallBadgeClass(status: WaterfallStep["status"]): string {
  return `badge badge--${status}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JobDetailPage() {
  const { jobId } = useParams();
  const job = MOCK_DETAIL;

  return (
    <div>
      <Link to="/jobs" className="back-link">
        &larr; Back to Jobs
      </Link>
      <div className="page-header">
        <h1 className="page-title">
          Job {jobId}
          <span style={{ marginLeft: 12 }}>
            <span className={statusBadgeClass(job.status)}>{job.status}</span>
          </span>
        </h1>
        <button className="btn btn--primary">Replay</button>
      </div>

      <div className="detail-card">
        <h3>Details</h3>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Seed URL</label>
            <span className="mono">{job.seed_url}</span>
          </div>
          <div className="detail-field">
            <label>Job Type</label>
            <span>{job.job_type}</span>
          </div>
          <div className="detail-field">
            <label>Engine</label>
            <span>{job.engine ?? "-"}</span>
          </div>
          <div className="detail-field">
            <label>Pages Scraped</label>
            <span>{job.pages_scraped}</span>
          </div>
          <div className="detail-field">
            <label>Created</label>
            <span>{formatTime(job.created_at)}</span>
          </div>
          {job.started_at && (
            <div className="detail-field">
              <label>Started</label>
              <span>{formatTime(job.started_at)}</span>
            </div>
          )}
          {job.completed_at && (
            <div className="detail-field">
              <label>Completed</label>
              <span>{formatTime(job.completed_at)}</span>
            </div>
          )}
          {job.cost_cents !== undefined && (
            <div className="detail-field">
              <label>Cost</label>
              <span className="mono">
                ${(job.cost_cents / 100).toFixed(2)}
              </span>
            </div>
          )}
          {job.error_message && (
            <div className="detail-field">
              <label>Error</label>
              <span style={{ color: "var(--color-status-failed)" }}>
                {job.error_message}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="detail-card">
        <h3>Waterfall</h3>
        {job.waterfall.map((step, i) => (
          <div key={i} className="waterfall-step">
            <div className={stepStatusClass(step.status)}>{step.attempt}</div>
            <div style={{ flex: 1 }}>
              <div>
                <strong>{step.engine}</strong>{" "}
                <span className={waterfallBadgeClass(step.status)}>
                  {step.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {formatTime(step.started_at)}
                {step.completed_at && ` -> ${formatTime(step.completed_at)}`}
              </div>
              {step.error_message && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-status-failed)",
                    marginTop: 2,
                  }}
                >
                  {step.error_message}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="detail-card">
        <h3>Artifacts</h3>
        <ul className="artifact-list">
          {job.artifacts.map((a: Artifact, i: number) => (
            <li key={i}>
              <span className="mono" style={{ fontSize: 12 }}>
                {a.content_hash}
              </span>
              <span className="badge badge--completed" style={{ fontSize: 10 }}>
                {a.content_type}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {formatBytes(a.size_bytes)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {job.extraction && (
        <div className="detail-card">
          <h3>Extraction</h3>
          <div className="detail-grid">
            <div className="detail-field">
              <label>Schema</label>
              <span className="mono">{job.extraction.schema_id}</span>
            </div>
            <div className="detail-field">
              <label>Status</label>
              <span className={`badge badge--${job.extraction.status}`}>
                {job.extraction.status}
              </span>
            </div>
            <div className="detail-field">
              <label>Confidence</label>
              <span className="mono">
                {(job.extraction.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          {job.extraction.validation_errors && (
            <div style={{ marginTop: 8 }}>
              {job.extraction.validation_errors.map((e, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: "var(--color-status-failed)",
                  }}
                >
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {job.llm_calls.length > 0 && (
        <div className="detail-card">
          <h3>LLM Calls</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Model</th>
                  <th>Prompt Tokens</th>
                  <th>Completion Tokens</th>
                  <th>Cost</th>
                  <th>At</th>
                </tr>
              </thead>
              <tbody>
                {job.llm_calls.map((call) => (
                  <tr key={call.id}>
                    <td className="mono">{call.id}</td>
                    <td>{call.model}</td>
                    <td className="mono">{call.prompt_tokens.toLocaleString()}</td>
                    <td className="mono">
                      {call.completion_tokens.toLocaleString()}
                    </td>
                    <td className="mono">
                      ${(call.cost_cents / 100).toFixed(2)}
                    </td>
                    <td>{formatTime(call.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}