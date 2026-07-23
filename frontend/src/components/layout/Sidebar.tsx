import { NavLink } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Database,
  Gauge,
  Home,
  ListChecks,
  Menu,
  Network,
  SearchCode,
  ShieldAlert,
  Sparkles,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { canAccessRoute, type RouteKey } from "../../lib/rbac";

// `routeKey` matches lib/rbac.ts's ROUTE_ROLES so a role only ever sees a
// nav entry for a page it can actually reach — no dead links.
const NAV_ITEMS: { to: string; label: string; icon: typeof Home; routeKey?: RouteKey }[] = [
  { to: "/dashboard", label: "Overview", icon: Home, routeKey: "dashboard" },
  { to: "/repositories", label: "Repositories", icon: Database, routeKey: "repositories" },
  { to: "/scans", label: "Scan Queue", icon: ListChecks, routeKey: "scans" },
  { to: "/risk", label: "Risk Dashboard", icon: ShieldAlert, routeKey: "risk" },
  { to: "/compliance", label: "Compliance", icon: ClipboardCheck, routeKey: "compliance" },
  { to: "/findings", label: "Finding Explorer", icon: SearchCode, routeKey: "findings" },
  { to: "/executive", label: "Executive Summary", icon: BarChart3, routeKey: "executive" },
  { to: "/my-activity", label: "My Activity", icon: Activity, routeKey: "my-activity" },
  { to: "/team-activity", label: "Team Activity", icon: Users, routeKey: "team-activity" },
  { to: "/knowledge", label: "Knowledge Base", icon: BookOpen, routeKey: "knowledge" },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles, routeKey: "assistant" },
  { to: "/rag-operations", label: "RAG Operations", icon: Gauge, routeKey: "rag-operations" },
  { to: "/admin/users", label: "User Management", icon: UserCog, routeKey: "admin/users" },
  { to: "/dashboard/architecture", label: "System Architecture", icon: Network, routeKey: "dashboard/architecture" },
];

/**
 * Icon-only rail by default, at every screen size — the hamburger at the
 * top expands it in place (pushing `<main>` over via normal flex reflow,
 * see AppShell) to show labels, and collapses back on its own click, an
 * Escape press, or picking a nav item. There is no overlay/backdrop and no
 * off-canvas positioning: this is always a normal, always-visible flex
 * child, just narrower or wider.
 */
export function Sidebar({
  expanded,
  onToggle,
  onCollapse,
}: {
  expanded: boolean;
  onToggle: () => void;
  onCollapse: () => void;
}) {
  const { user } = useAuth();
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.routeKey || canAccessRoute(user?.role, item.routeKey),
  );

  return (
    <aside
      id="app-sidebar"
      aria-label="Main navigation"
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-300 ease-out",
        expanded ? "w-64" : "w-16",
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          onClick={onToggle}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted"
          aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          aria-expanded={expanded}
          aria-controls="app-sidebar"
        >
          <Menu
            className={cn(
              "absolute inset-0 m-auto size-6 transition-all duration-200 ease-out",
              expanded ? "rotate-90 opacity-0" : "rotate-0 opacity-100",
            )}
          />
          <X
            className={cn(
              "absolute inset-0 m-auto size-6 transition-all duration-200 ease-out",
              expanded ? "rotate-0 opacity-100" : "-rotate-90 opacity-0",
            )}
          />
        </button>
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap text-lg font-semibold tracking-tight text-foreground transition-opacity duration-200",
            expanded ? "opacity-100 delay-100" : "opacity-0",
          )}
        >
          KAVACH
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
        {visibleNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onCollapse}
            aria-label={label}
            title={expanded ? undefined : label}
            className={({ isActive }) =>
              cn(
                "sidebar-nav-link flex w-full items-center overflow-hidden rounded-lg py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 ease-out",
                expanded ? "justify-start gap-3 px-3" : "justify-center px-0",
                isActive
                  ? "is-active bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <Icon className="sidebar-nav-icon size-6 shrink-0" />
            {/* `max-w-0` (not just opacity) when collapsed — otherwise the
                label keeps its full text width even while invisible, which
                widens the link past the rail and clips the active pill. */}
            <span
              className={cn(
                "overflow-hidden transition-all duration-200",
                expanded ? "max-w-40 opacity-100 delay-100" : "max-w-0 opacity-0",
              )}
            >
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div
        className={cn(
          "overflow-hidden whitespace-nowrap border-t border-border p-4 text-xs text-muted-foreground transition-opacity duration-200",
          expanded ? "opacity-100 delay-100" : "opacity-0",
        )}
      >
        AI-Powered DevSecOps for Banking
      </div>
    </aside>
  );
}
