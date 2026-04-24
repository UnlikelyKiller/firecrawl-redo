import { useState } from "react";
import type { DomainPolicy, DomainPolicyAction } from "../types";

const MOCK_POLICIES: readonly DomainPolicy[] = [
  {
    domain: "example.com",
    action: "allow",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
  },
  {
    domain: "internal.corp",
    action: "block",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
  {
    domain: "aggregator.io",
    action: "rate_limit",
    rate_limit_rpm: 10,
    max_depth: 2,
    created_at: "2026-03-10T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
];

function actionBadgeClass(action: DomainPolicyAction): string {
  return `badge badge--${action}`;
}

export function DomainsPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [policies, setPolicies] = useState<readonly DomainPolicy[]>(
    MOCK_POLICIES,
  );

  const handleAdd = (domain: string, action: DomainPolicyAction, rpm?: number, depth?: number) => {
    const now = new Date().toISOString();
    const newPolicy: DomainPolicy = {
      domain,
      action,
      rate_limit_rpm: action === "rate_limit" ? rpm : undefined,
      max_depth: depth,
      created_at: now,
      updated_at: now,
    };
    setPolicies((prev) => [...prev, newPolicy]);
    setShowDialog(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Domain Policies</h1>
        <button
          className="btn btn--primary"
          onClick={() => setShowDialog(true)}
        >
          Add Policy
        </button>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Action</th>
              <th>Rate Limit (RPM)</th>
              <th>Max Depth</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.domain}>
                <td className="mono">{p.domain}</td>
                <td>
                  <span className={actionBadgeClass(p.action)}>
                    {p.action}
                  </span>
                </td>
                <td className="mono">{p.rate_limit_rpm ?? "-"}</td>
                <td className="mono">{p.max_depth ?? "-"}</td>
                <td>{new Date(p.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && (
        <DomainPolicyDialog
          onSubmit={handleAdd}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}

function DomainPolicyDialog({
  onSubmit,
  onClose,
}: {
  readonly onSubmit: (
    domain: string,
    action: DomainPolicyAction,
    rpm?: number,
    depth?: number,
  ) => void;
  readonly onClose: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [action, setAction] = useState<DomainPolicyAction>("allow");
  const [rpm, setRpm] = useState("");
  const [depth, setDepth] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      domain,
      action,
      rpm ? Number(rpm) : undefined,
      depth ? Number(depth) : undefined,
    );
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>Add Domain Policy</h2>
        <label>Domain</label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          required
        />
        <label>Action</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as DomainPolicyAction)}
        >
          <option value="allow">Allow</option>
          <option value="block">Block</option>
          <option value="rate_limit">Rate Limit</option>
        </select>
        {action === "rate_limit" && (
          <>
            <label>Rate Limit (requests per minute)</label>
            <input
              type="number"
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              placeholder="10"
            />
          </>
        )}
        <label>Max Crawl Depth</label>
        <input
          type="number"
          value={depth}
          onChange={(e) => setDepth(e.target.value)}
          placeholder="Unlimited"
        />
        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}