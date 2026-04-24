import type { Extraction, ExtractionStatus } from "../types";

const MOCK_EXTRACTIONS: readonly Extraction[] = [
  {
    id: "ext_001",
    job_id: "job_01HXYZ001",
    schema_id: "product_schema_v2",
    status: "completed",
    confidence: 0.94,
    created_at: "2026-04-24T10:03:00Z",
  },
  {
    id: "ext_002",
    job_id: "job_01HXYZ006",
    schema_id: "article_schema_v1",
    status: "completed",
    confidence: 0.87,
    created_at: "2026-04-24T09:45:00Z",
  },
  {
    id: "ext_003",
    job_id: "job_01HXYZ007",
    schema_id: "contact_schema_v1",
    status: "failed",
    confidence: 0.22,
    created_at: "2026-04-24T09:20:00Z",
    validation_errors: [
      "Missing required field: email",
      "phone format invalid",
    ],
  },
  {
    id: "ext_004",
    job_id: "job_01HXYZ008",
    schema_id: "product_schema_v2",
    status: "validation_error",
    confidence: 0.61,
    created_at: "2026-04-24T08:10:00Z",
    validation_errors: ["price: expected number, got string"],
  },
  {
    id: "ext_005",
    job_id: "job_01HXYZ009",
    schema_id: "metadata_schema_v1",
    status: "pending",
    confidence: 0,
    created_at: "2026-04-24T10:15:00Z",
  },
];

function extractionBadgeClass(status: ExtractionStatus): string {
  return `badge badge--${status}`;
}

export function ExtractionsPage() {
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
            {MOCK_EXTRACTIONS.map((ext) => (
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
                <td>{new Date(ext.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}