import { NavLink } from "react-router-dom";
import {
  BarChart3,
  ClipboardCheck,
  Database,
  ListChecks,
  SearchCode,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

const NAV_ITEMS = [
  { to: "/repositories", label: "Repositories", icon: Database },
  { to: "/scans", label: "Scan Queue", icon: ListChecks },
  { to: "/risk", label: "Risk Dashboard", icon: ShieldAlert },
  { to: "/compliance", label: "Compliance", icon: ClipboardCheck },
  { to: "/findings", label: "Finding Explorer", icon: SearchCode },
  { to: "/executive", label: "Executive Summary", icon: BarChart3 },
];

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onCloseMobile} aria-hidden />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
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
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
