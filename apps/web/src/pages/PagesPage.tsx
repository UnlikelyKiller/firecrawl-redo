import type { ScrapePage } from "../types";

const MOCK_PAGES: readonly ScrapePage[] = [
  {
    id: "page_001",
    url: "https://example.com/",
    content_hash: "sha256:a1b2c3d4e5f6",
    status: "scraped",
    status_code: 200,
    last_scraped_at: "2026-04-24T10:01:00Z",
    change_indicator: "unchanged",
  },
  {
    id: "page_002",
    url: "https://example.com/about",
    content_hash: "sha256:b2c3d4e5f6a7",
    status: "changed",
    status_code: 200,
    last_scraped_at: "2026-04-24T10:01:30Z",
    change_indicator: "changed",
  },
  {
    id: "page_003",
    url: "https://example.com/products",
    content_hash: "sha256:c3d4e5f6a7b8",
    status: "scraped",
    status_code: 200,
    last_scraped_at: "2026-04-24T10:02:00Z",
    change_indicator: "new",
  },
  {
    id: "page_004",
    url: "https://example.com/legacy",
    content_hash: "sha256:d4e5f6a7b8c9",
    status: "failed",
    status_code: 404,
    last_scraped_at: "2026-04-24T10:02:15Z",
  },
  {
    id: "page_005",
    url: "https://example.com/blog/post-1",
    content_hash: "sha256:e5f6a7b8c9d0",
    status: "scraped",
    status_code: 200,
    last_scraped_at: "2026-04-24T10:02:45Z",
    change_indicator: "unchanged",
  },
];

function changeBadgeClass(
  indicator: ScrapePage["change_indicator"],
): string {
  if (indicator === "new") return "badge badge--running";
  if (indicator === "changed") return "badge badge--queued";
  return "badge badge--completed";
}

export function PagesPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pages</h1>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Content Hash</th>
              <th>Change</th>
              <th>Status</th>
              <th>Status Code</th>
              <th>Last Scraped</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PAGES.map((page) => (
              <tr key={page.id}>
                <td>{page.url}</td>
                <td className="mono" style={{ fontSize: 11 }}>
                  {page.content_hash}
                </td>
                <td>
                  {page.change_indicator ? (
                    <span className={changeBadgeClass(page.change_indicator)}>
                      {page.change_indicator}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <span
                    className={`badge badge--${
                      page.status === "failed" ? "failed" : "completed"
                    }`}
                  >
                    {page.status}
                  </span>
                </td>
                <td className="mono">{page.status_code ?? "-"}</td>
                <td>{new Date(page.last_scraped_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}