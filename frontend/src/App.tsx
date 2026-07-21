import { lazy, Suspense, type JSX, type LazyExoticComponent } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { RequireRole } from "./components/layout/RequireRole";
import { FullPageSpinner } from "./components/ui/Spinner";
import { useAuth } from "./hooks/useAuth";
import { defaultRouteForRole } from "./lib/rbac";

// Route-level code splitting — each dashboard page ships in its own chunk,
// fetched only when the user navigates there.
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const RepositoriesPage = lazy(() => import("./pages/RepositoriesPage"));
const ScanQueuePage = lazy(() => import("./pages/ScanQueuePage"));
const RiskDashboardPage = lazy(() => import("./pages/RiskDashboardPage"));
const ComplianceDashboardPage = lazy(() => import("./pages/ComplianceDashboardPage"));
const FindingExplorerPage = lazy(() => import("./pages/FindingExplorerPage"));
const ExecutiveDashboardPage = lazy(() => import("./pages/ExecutiveDashboardPage"));
const SystemArchitecturePage = lazy(() => import("./pages/SystemArchitecturePage"));
const PublicArchitecturePage = lazy(() => import("./pages/PublicArchitecturePage"));
const MyActivityPage = lazy(() => import("./pages/MyActivityPage"));
const TeamActivityPage = lazy(() => import("./pages/TeamActivityPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBasePage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const RagOperationsPage = lazy(() => import("./pages/RagOperationsPage"));

function SuspendedRoute({ Component }: { Component: LazyExoticComponent<() => JSX.Element> }) {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Component />
    </Suspense>
  );
}

// Catch-all target for both an unknown path and the historical bare
// "go to the app" case — role-aware since a plain "/repositories" fallback
// would immediately bounce Executive/Read Only users into another redirect.
function DefaultRedirect() {
  const { status, user } = useAuth();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteForRole(user?.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Always the public marketing page — including for an
          already-authenticated visitor, by explicit product decision. */}
      <Route path="/" element={<SuspendedRoute Component={LandingPage} />} />
      <Route path="/login" element={<SuspendedRoute Component={LoginPage} />} />
      <Route path="/signup" element={<SuspendedRoute Component={SignupPage} />} />
      {/* Public, unauthenticated architecture explorer — reached from the
          landing page's "Explore Architecture" button. Deliberately NOT
          nested under ProtectedRoute/AppShell: no login required, no
          sidebar/topbar. Its own component provides the background/
          padding and a "Back to Home" action; it shares
          ArchitectureExplorer's content with the authenticated
          /dashboard/architecture route below rather than duplicating it. */}
      <Route path="/architecture" element={<SuspendedRoute Component={PublicArchitecturePage} />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route
          path="dashboard"
          element={
            <RequireRole routeKey="dashboard">
              <SuspendedRoute Component={OverviewPage} />
            </RequireRole>
          }
        />
        <Route
          path="repositories"
          element={
            <RequireRole routeKey="repositories">
              <SuspendedRoute Component={RepositoriesPage} />
            </RequireRole>
          }
        />
        <Route
          path="scans"
          element={
            <RequireRole routeKey="scans">
              <SuspendedRoute Component={ScanQueuePage} />
            </RequireRole>
          }
        />
        <Route
          path="scans/:scanJobId"
          element={
            <RequireRole routeKey="scans">
              <SuspendedRoute Component={ScanQueuePage} />
            </RequireRole>
          }
        />
        <Route
          path="risk"
          element={
            <RequireRole routeKey="risk">
              <SuspendedRoute Component={RiskDashboardPage} />
            </RequireRole>
          }
        />
        <Route
          path="compliance"
          element={
            <RequireRole routeKey="compliance">
              <SuspendedRoute Component={ComplianceDashboardPage} />
            </RequireRole>
          }
        />
        <Route
          path="findings"
          element={
            <RequireRole routeKey="findings">
              <SuspendedRoute Component={FindingExplorerPage} />
            </RequireRole>
          }
        />
        <Route
          path="executive"
          element={
            <RequireRole routeKey="executive">
              <SuspendedRoute Component={ExecutiveDashboardPage} />
            </RequireRole>
          }
        />
        <Route
          path="my-activity"
          element={
            <RequireRole routeKey="my-activity">
              <SuspendedRoute Component={MyActivityPage} />
            </RequireRole>
          }
        />
        <Route
          path="team-activity"
          element={
            <RequireRole routeKey="team-activity">
              <SuspendedRoute Component={TeamActivityPage} />
            </RequireRole>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireRole routeKey="admin/users">
              <SuspendedRoute Component={AdminUsersPage} />
            </RequireRole>
          }
        />
        <Route
          path="knowledge"
          element={
            <RequireRole routeKey="knowledge">
              <SuspendedRoute Component={KnowledgeBasePage} />
            </RequireRole>
          }
        />
        <Route
          path="assistant"
          element={
            <RequireRole routeKey="assistant">
              <SuspendedRoute Component={AssistantPage} />
            </RequireRole>
          }
        />
        <Route
          path="rag-operations"
          element={
            <RequireRole routeKey="rag-operations">
              <SuspendedRoute Component={RagOperationsPage} />
            </RequireRole>
          }
        />
        <Route
          path="dashboard/architecture"
          element={
            <RequireRole routeKey="dashboard/architecture">
              <SuspendedRoute Component={SystemArchitecturePage} />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}
