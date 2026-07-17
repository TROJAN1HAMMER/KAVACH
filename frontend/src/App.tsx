import { lazy, Suspense, type JSX, type LazyExoticComponent } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { FullPageSpinner } from "./components/ui/Spinner";

// Route-level code splitting — each dashboard page ships in its own chunk,
// fetched only when the user navigates there.
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RepositoriesPage = lazy(() => import("./pages/RepositoriesPage"));
const ScanQueuePage = lazy(() => import("./pages/ScanQueuePage"));
const RiskDashboardPage = lazy(() => import("./pages/RiskDashboardPage"));
const ComplianceDashboardPage = lazy(() => import("./pages/ComplianceDashboardPage"));
const FindingExplorerPage = lazy(() => import("./pages/FindingExplorerPage"));
const ExecutiveDashboardPage = lazy(() => import("./pages/ExecutiveDashboardPage"));

function SuspendedRoute({ Component }: { Component: LazyExoticComponent<() => JSX.Element> }) {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Component />
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<SuspendedRoute Component={LoginPage} />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/repositories" replace />} />
        <Route path="repositories" element={<SuspendedRoute Component={RepositoriesPage} />} />
        <Route path="scans" element={<SuspendedRoute Component={ScanQueuePage} />} />
        <Route path="scans/:scanJobId" element={<SuspendedRoute Component={ScanQueuePage} />} />
        <Route path="risk" element={<SuspendedRoute Component={RiskDashboardPage} />} />
        <Route path="compliance" element={<SuspendedRoute Component={ComplianceDashboardPage} />} />
        <Route path="findings" element={<SuspendedRoute Component={FindingExplorerPage} />} />
        <Route path="executive" element={<SuspendedRoute Component={ExecutiveDashboardPage} />} />
      </Route>

      <Route path="*" element={<Navigate to="/repositories" replace />} />
    </Routes>
  );
}
