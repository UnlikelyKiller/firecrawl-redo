import { useState, useEffect } from "react";
import type { BrowserReceipt } from "../types";
import { api } from "../api/client";
import { formatTime } from "../utils/formatters";

const API_BASE: string =
  import.meta.env.VITE_API_URL ?? window.location.origin;

function isArtifactUrl(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  );
}

function resolveArtifactUrl(value: string): string {
  return new URL(value, API_BASE).toString();
}

export function ReceiptsPage() {
  const [receipts, setReceipts] = useState<readonly BrowserReceipt[]>([]);
  const [ariaSnapshots, setAriaSnapshots] = useState<Readonly<Record<string, string>>>({});
  const [ariaSnapshotErrors, setAriaSnapshotErrors] = useState<Readonly<Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.fetchReceipts({ page })
      .then(res => {
        if (cancelled) return;
        setReceipts(res.data);
        setTotalPages(res.total_pages);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    const artifactBackedReceipts = receipts.filter(
      receipt =>
        typeof receipt.aria_snapshot === "string" &&
        isArtifactUrl(receipt.aria_snapshot),
    );

    if (artifactBackedReceipts.length === 0) {
      setAriaSnapshots({});
      setAriaSnapshotErrors({});
      return () => controller.abort();
    }

    setAriaSnapshotErrors({});

    void Promise.allSettled(
      artifactBackedReceipts.map(async receipt => {
        const snapshotUrl = resolveArtifactUrl(receipt.aria_snapshot!);
        const response = await fetch(snapshotUrl, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load ARIA snapshot: ${response.status}`);
        }
        const text = await response.text();
        return [receipt.id, text] as const;
      }),
    )
      .then(results => {
        const snapshots: Record<string, string> = {};
        const errors: Record<string, string> = {};

        results.forEach((result, index) => {
          const receipt = artifactBackedReceipts[index];
          if (result.status === "fulfilled") {
            const [id, text] = result.value;
            snapshots[id] = text;
            return;
          }
          errors[receipt.id] =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
        });

        setAriaSnapshots(snapshots);
        setAriaSnapshotErrors(errors);
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setAriaSnapshotErrors({});
      });

    return () => controller.abort();
  }, [receipts]);

  if (loading && receipts.length === 0) return <div className="loading">Loading receipts...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Browser Receipts</h1>
      </div>

      {receipts.length === 0 ? (
        <div className="detail-card">No receipts found.</div>
      ) : (
        <>
          {receipts.map((receipt) => {
            const ariaSnapshotSource = receipt.aria_snapshot;
            const ariaSnapshotUrl =
              ariaSnapshotSource && isArtifactUrl(ariaSnapshotSource)
                ? resolveArtifactUrl(ariaSnapshotSource)
                : undefined;
            const ariaSnapshotText = ariaSnapshotSource
              ? ariaSnapshotUrl
                ? ariaSnapshots[receipt.id]
                : ariaSnapshotSource
              : undefined;
            const ariaSnapshotError = ariaSnapshotErrors[receipt.id];

            return (
              <div key={receipt.id} className="detail-card">
                <h3 className="mono" style={{ textTransform: "none" }}>
                  {receipt.url}
                </h3>
                <div className="detail-grid" style={{ marginBottom: 16 }}>
                  <div className="detail-field">
                    <label>Receipt ID</label>
                    <span className="mono">{receipt.id}</span>
                  </div>
                  <div className="detail-field">
                    <label>Job ID</label>
                    <span className="mono">{receipt.job_id}</span>
                  </div>
                  <div className="detail-field">
                    <label>Created</label>
                    <span>{formatTime(receipt.created_at)}</span>
                  </div>
                  <div className="detail-field">
                    <label>Video</label>
                    <span>
                      {receipt.video_url ? (
                        <a
                          href={resolveArtifactUrl(receipt.video_url)}
                          style={{ color: "var(--color-primary)" }}
                        >
                          View Recording
                        </a>
                      ) : (
                        "Not available"
                      )}
                    </span>
                  </div>
                </div>

                {ariaSnapshotSource && (
                  <div style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--color-text-muted)",
                        marginBottom: 4,
                      }}
                    >
                      ARIA Snapshot
                    </label>
                    <pre
                      style={{
                        background: "var(--color-bg)",
                        padding: 12,
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        overflow: "auto",
                        maxHeight: 160,
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {ariaSnapshotText ?? "Loading ARIA snapshot..."}
                    </pre>
                    {ariaSnapshotUrl && (
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        <a
                          href={ariaSnapshotUrl}
                          style={{ color: "var(--color-primary)" }}
                        >
                          Open artifact
                        </a>
                      </div>
                    )}
                    {ariaSnapshotError && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "var(--color-status-failed)",
                        }}
                      >
                        {ariaSnapshotError}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--color-text-muted)",
                      marginBottom: 4,
                    }}
                  >
                    Action Timeline
                  </label>
                  {receipt.action_timeline.map((action, i) => (
                    <div key={i} className="timeline-entry">
                      <span className="timestamp">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </span>
                      <div className="details">
                        <span style={{ fontWeight: 600 }}>{action.action}</span>
                        {action.selector && (
                          <span
                            className="mono"
                            style={{
                              fontSize: 11,
                              color: "var(--color-text-muted)",
                              marginLeft: 8,
                            }}
                          >
                            {action.selector}
                          </span>
                        )}
                        {action.value && (
                          <span
                            className="mono"
                            style={{
                              fontSize: 11,
                              color: "var(--color-text-muted)",
                              marginLeft: 8,
                            }}
                          >
                            = {action.value}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--color-text-muted)",
                            marginLeft: 12,
                          }}
                        >
                          {action.duration_ms}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
        </>
      )}
    </div>
  );
}
