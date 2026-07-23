import { useState } from "react";
import { LogOut, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

export function Topbar({
  onOpenPalette,
  sidebarExpanded,
}: {
  onOpenPalette: () => void;
  /** The expanded sidebar shows this exact "shield + KAVACH" brand mark
   *  itself (see `Sidebar.tsx`'s own header row) — this fades out rather
   *  than ever appearing at the same time, so there's never a second,
   *  duplicate brand mark on screen. */
  sidebarExpanded: boolean;
}) {
  const { user, logout } = useAuth();

  // Cosmetic only — the actual Ctrl/Cmd+K listener lives in
  // useCommandPaletteShortcut (AppShell). This just decides which of the
  // two labels the hint pill shows. Computed once via useState's lazy
  // initializer (this is a plain Vite SPA, so `window` is always present —
  // no SSR/hydration concern) rather than an effect, since it never changes.
  const [isMac] = useState(() => /mac|iphone|ipad|ipod/i.test(window.navigator.userAgent));

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 pr-4 backdrop-blur sm:pr-6",
        // Tighter left padding while the brand mark is showing, since it's
        // sitting right next to the sidebar's own collapsed hamburger —
        // the wider padding returns once the sidebar (and its own brand
        // mark) takes over on expand.
        sidebarExpanded ? "pl-4 sm:pl-6" : "pl-3",
      )}
    >
      {/* Kept permanently in the layout (never unmounted, no width
          collapse) so hiding it on expand is a pure opacity/transform
          fade — never a layout jump for the search bar next to it. */}
      <div
        aria-hidden={sidebarExpanded}
        className={cn(
          "flex shrink-0 items-center gap-3 transition-[opacity,transform] duration-200 ease-in-out",
          sidebarExpanded ? "pointer-events-none -translate-x-2 opacity-0" : "translate-x-0 opacity-100",
        )}
      >
        <ShieldCheck aria-hidden="true" className="size-6 shrink-0 text-primary" />
        <span className="hidden text-lg font-semibold tracking-wide text-foreground sm:inline">KAVACH</span>
      </div>

      <div className="flex flex-1 justify-center sm:justify-start">
        <button
          onClick={onOpenPalette}
          aria-label="Open command palette"
          className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden truncate sm:inline">Search KAVACH…</span>
          <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium sm:inline-flex">
            {isMac ? "⌘" : "Ctrl"}
            <span>K</span>
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user && (
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {user.full_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-foreground">{user.full_name || user.email}</p>
              <p className="text-xs text-muted-foreground">{user.role_display_name}</p>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={logout} aria-label="Log out">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
