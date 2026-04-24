import { createBrowserRouter, RouterProvider, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { JobsPage } from "./pages/JobsPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { PagesPage } from "./pages/PagesPage";
import { FailuresPage } from "./pages/FailuresPage";
import { DomainsPage } from "./pages/DomainsPage";
import { ExtractionsPage } from "./pages/ExtractionsPage";
import { ActivityPage } from "./pages/ActivityPage";
import { UsagePage } from "./pages/UsagePage";
import { ReceiptsPage } from "./pages/ReceiptsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/jobs" replace /> },
      { path: "jobs", element: <JobsPage /> },
      { path: "jobs/:jobId", element: <JobDetailPage /> },
      { path: "pages", element: <PagesPage /> },
      { path: "failures", element: <FailuresPage /> },
      { path: "domains", element: <DomainsPage /> },
      { path: "extractions", element: <ExtractionsPage /> },
      { path: "activity", element: <ActivityPage /> },
      { path: "usage", element: <UsagePage /> },
      { path: "receipts", element: <ReceiptsPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}