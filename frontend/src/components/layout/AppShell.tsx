import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { FullPageSpinner } from "../ui/Spinner";
import { useGlobalScanJobsWatcher } from "../../hooks/useScanJobs";

export function AppShell() {
  // Icon-only rail is the resting state everywhere (desktop included) —
  // expanding it pushes `<main>` over via normal flex reflow (the sidebar
  // is a plain flex sibling, not an overlay), rather than floating on top
  // of the page.
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const location = useLocation();

  // Mounted once, for the whole authenticated app, regardless of which page
  // is open — see useGlobalScanJobsWatcher's docstring for why this is
  // needed on top of each page's own data fetching.
  useGlobalScanJobsWatcher();

  // Collapse back to the icon rail on navigation — adjusting state during
  // render (React's documented alternative to an effect for "reset when a
  // value changes": https://react.dev/learn/you-might-not-need-an-effect)
  // rather than a `useEffect`, so it can't cascade an extra render.
  const [lastPathname, setLastPathname] = useState(location.pathname);
  if (location.pathname !== lastPathname) {
    setLastPathname(location.pathname);
    setSidebarExpanded(false);
  }

  // Escape collapses the expanded rail, same as clicking its own toggle.
  useEffect(() => {
    if (!sidebarExpanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarExpanded(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarExpanded]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((current) => !current)}
        onCollapse={() => setSidebarExpanded(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<FullPageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
