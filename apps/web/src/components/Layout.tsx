import { NavLink, Outlet } from "react-router";

const NAV_ITEMS: readonly { readonly path: string; readonly label: string }[] = [
  { path: "/jobs", label: "Jobs" },
  { path: "/pages", label: "Pages" },
  { path: "/failures", label: "Failures" },
  { path: "/domains", label: "Domains" },
  { path: "/extractions", label: "Extractions" },
  { path: "/activity", label: "Activity" },
  { path: "/usage", label: "Usage" },
  { path: "/receipts", label: "Receipts" },
];

export function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">CrawlX</h1>
          <span className="sidebar-subtitle">Dashboard</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " sidebar-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}