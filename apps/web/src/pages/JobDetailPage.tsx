import { useParams, Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import type { JobDetail, WaterfallStep, Artifact, JobStatus } from "../types";
import { api } from "../api/client";
import { formatTime } from "../utils/formatters";

function statusBadgeClass(status: JobStatus): string {
  return `badge badge--${status.toLowerCase()}`;
}

function stepStatusClass(status: WaterfallStep["status"]): string {
  return `step-number step-number--${status}`;
}

function waterfallBadgeClass(status: WaterfallStep["status"]): string {
  return `badge badge--${status}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JobDetailPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    api.fetchJob(jobId)
      .then(res => {
        setJob(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [jobId]);

  const handleReplay = async () => {
    if (!jobId || replaying) return;
    setReplaying(true);
    setReplayError(null);
    try {
      const newJob = await api.replayJob(jobId);
      navigate(`/jobs/${newJob.id}`);
    } catch (err: unknown) {
      setReplayError(err instanceof Error ? err.message : String(err));
      setReplaying(false);
    }
  };

  if (loading) return <div className="loading">Loading job details...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!job) return <div className="error">Job not found.</div>;

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
        <div className="page-actions">
          {replayError && <span className="error small" style={{ marginRight: 12 }}>{replayError}</span>}
          <button 
            className="btn btn--primary" 
            onClick={handleReplay}
            disabled={replaying}
          >
            {replaying ? "Replaying..." : "Replay"}
          </button>
        </div>
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