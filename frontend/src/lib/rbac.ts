// Frontend route/nav gating for the 5 backend UserRole values. This is a
// UX layer only — the real security boundary is server-side
// (require_permission(...) dependencies + PermissionMiddleware, see
// backend/app/auth/permissions.py). The goal here is just "don't show a
// role a broken/empty page or a dead nav link for something it can't
// reach" by redirecting cleanly instead.
//
// Presentation-only display-name map for the admin role-picker dropdown.
// The backend tells us the CURRENT user's resolved `role_display_name`,
// but not a lookup table for all 5 roles — this small map is intentionally
// NOT a duplicate of the permission matrix (see types/api.ts's `User.
// permissions`, which IS the source of truth for what a role can do).
import type { UserRole } from "../types/api";

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: "Administrator",
  security_engineer: "Security Manager",
  developer: "Security Analyst",
  auditor: "Executive / Board Member",
  read_only: "Read Only",
};

export const ALL_ROLES: UserRole[] = ["admin", "security_engineer", "developer", "auditor", "read_only"];

// Keyed by the route's path segment as used in App.tsx (no leading slash;
// "scans" covers both /scans and /scans/:scanJobId). Sidebar filtering and
// RequireRole both read from this single table so nav links and actual
// route access can never disagree.
export const ROUTE_ROLES = {
  dashboard: ["admin", "security_engineer", "developer"],
  repositories: ["admin", "security_engineer", "developer"],
  scans: ["admin", "security_engineer", "developer"],
  risk: ["admin", "security_engineer", "developer", "auditor", "read_only"],
  compliance: ["admin", "security_engineer", "developer", "auditor", "read_only"],
  findings: ["admin", "security_engineer", "developer"],
  executive: ["admin", "security_engineer", "auditor", "read_only"],
  "my-activity": ["admin", "security_engineer", "developer"],
  "team-activity": ["admin", "security_engineer"],
  "admin/users": ["admin"],
  // Matches Permission.KNOWLEDGE_READ's role set exactly (see
  // backend/app/auth/permissions.py) — every role that can search the
  // knowledge base can reach this page; upload/delete are further gated
  // inside the page itself via usePermissions().hasPermission("knowledge:write").
  knowledge: ["admin", "security_engineer", "developer", "auditor"],
  // Same role set as `knowledge` — asking the assistant a question is a
  // read of the knowledge base, gated by the same Permission.KNOWLEDGE_READ
  // server-side (see backend/app/api/v1/endpoints/assistant.py).
  assistant: ["admin", "security_engineer", "developer", "auditor"],
  // Matches Permission.TEAM_ANALYTICS_READ's role set (see
  // backend/app/api/v1/endpoints/rag_operations.py) — the same audience
  // already reviewing team scan activity.
  "rag-operations": ["admin", "security_engineer"],
  // Every authenticated role — this page was public/unrestricted before
  // it lived inside the dashboard shell too (see App.tsx: the actual
  // public, unauthenticated copy is still reachable at /architecture with
  // no role check at all), so becoming a dashboard route shouldn't newly
  // restrict which signed-in roles can see it.
  "dashboard/architecture": ["admin", "security_engineer", "developer", "auditor", "read_only"],
} as const satisfies Record<string, UserRole[]>;

export type RouteKey = keyof typeof ROUTE_ROLES;

// Where to send a role whose current route it can't access — e.g. a stale
// deep link, the post-login redirect, or the catch-all `*` fallback.
// Executive/Read Only can't reach /repositories (the app's traditional
// default landing page), so they land on /executive instead.
export const DEFAULT_ROUTE_FOR_ROLE: Record<UserRole, string> = {
  admin: "/repositories",
  security_engineer: "/repositories",
  developer: "/repositories",
  auditor: "/executive",
  read_only: "/executive",
};

export function canAccessRoute(role: UserRole | undefined | null, routeKey: RouteKey): boolean {
  if (!role) return false;
  return (ROUTE_ROLES[routeKey] as readonly UserRole[]).includes(role);
}

export function defaultRouteForRole(role: UserRole | undefined | null): string {
  if (!role) return "/login";
  return DEFAULT_ROUTE_FOR_ROLE[role];
}
