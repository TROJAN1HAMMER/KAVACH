import { NavLink } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Database,
  Gauge,
  Home,
  ListChecks,
  Network,
  SearchCode,
  ShieldAlert,
  ShieldCheck,
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

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.routeKey || canAccessRoute(user?.role, item.routeKey),
  );

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={onCloseMobile}
            aria-hidden
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 ease-out",
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight text-foreground">KAVACH</span>
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="size-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          AI-Powered DevSecOps for Banking
        </div>
      </aside>
    </>
  );
}
