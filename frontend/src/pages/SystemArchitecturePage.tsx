import { ArchitectureExplorer } from "../components/architecture/ArchitectureExplorer";

/**
 * Dashboard route (`/dashboard/architecture`) — rendered inside AppShell
 * (sidebar/topbar/breadcrumbs/theme/RBAC all apply automatically, same
 * as every other dashboard page) via App.tsx's protected route group.
 * See pages/PublicArchitecturePage.tsx for the public, unauthenticated
 * counterpart — both share ArchitectureExplorer's content verbatim.
 */
export default function SystemArchitecturePage() {
  return <ArchitectureExplorer />;
}
