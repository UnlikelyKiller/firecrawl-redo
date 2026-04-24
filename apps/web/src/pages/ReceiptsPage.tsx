import type { BrowserReceipt } from "../types";

const MOCK_RECEIPTS: readonly BrowserReceipt[] = [
  {
    id: "rcpt_001",
    job_id: "job_01HXYZ001",
    url: "https://example.com/products/widget",
    video_url: "/receipts/rcpt_001/video.webm",
    aria_snapshot:
      "[document]\n  [navigation]\n    [link 'Home']\n    [link 'Products']\n  [main]\n    [heading 'Widget Pro']\n    [button 'Add to Cart']",
    action_timeline: [
      {
        action: "navigate",
        timestamp: "2026-04-24T10:00:04.000Z",
        duration_ms: 1200,
      },
      {
        action: "click",
        selector: "#accept-cookies",
        timestamp: "2026-04-24T10:00:05.300Z",
        duration_ms: 150,
      },
      {
        action: "waitForSelector",
        selector: ".product-title",
        timestamp: "2026-04-24T10:00:05.500Z",
        duration_ms: 800,
      },
      {
        action: "scroll",
        value: "300",
        timestamp: "2026-04-24T10:00:06.400Z",
        duration_ms: 200,
      },
    ],
    created_at: "2026-04-24T10:00:04Z",
  },
  {
    id: "rcpt_002",
    job_id: "job_01HXYZ002",
    url: "https://docs.python.org/3/",
    action_timeline: [
      {
        action: "navigate",
        timestamp: "2026-04-24T10:10:01.000Z",
        duration_ms: 900,
      },
      {
        action: "waitForSelector",
        selector: "#documentation",
        timestamp: "2026-04-24T10:10:02.000Z",
        duration_ms: 450,
      },
    ],
    created_at: "2026-04-24T10:10:01Z",
  },
];

export function ReceiptsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Browser Receipts</h1>
      </div>

      {MOCK_RECEIPTS.map((receipt) => (
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
              <span>{new Date(receipt.created_at).toLocaleString()}</span>
            </div>
            <div className="detail-field">
              <label>Video</label>
              <span>
                {receipt.video_url ? (
                  <a
                    href={receipt.video_url}
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

          {receipt.aria_snapshot && (
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
                {receipt.aria_snapshot}
              </pre>
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
      ))}
    </div>
  );
}