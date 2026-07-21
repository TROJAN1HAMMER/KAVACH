/// One entry per navigable area of the app. This is a UX-only gate — it
/// hides nav items / redirects away from screens a role shouldn't see so the
/// user never lands on a dead page. It is **not** a security boundary; the
/// backend re-checks every mutating call via `require_permission(...)` and
/// `PermissionMiddleware` regardless of what this hides. Mirrors
/// `frontend/src/lib/rbac.ts`'s `RouteKey` union, minus the RAG-specific
/// routes (knowledge/assistant/rag-operations) which are out of scope for
/// this milestone per the task brief ("Do NOT implement RAG").
enum RouteKey {
  dashboard,
  repositories,
  scans,
  risk,
  compliance,
  findings,
  executive,
  architecture,
  reports,
  notifications,
  profile,
  settings,
  about,
}
