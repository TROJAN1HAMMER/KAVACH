import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { FullPageSpinner } from "../ui/Spinner";
import { useGlobalScanJobsWatcher } from "../../hooks/useScanJobs";

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Mounted once, for the whole authenticated app, regardless of which page
  // is open — see useGlobalScanJobsWatcher's docstring for why this is
  // needed on top of each page's own data fetching.
  useGlobalScanJobsWatcher();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<FullPageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
