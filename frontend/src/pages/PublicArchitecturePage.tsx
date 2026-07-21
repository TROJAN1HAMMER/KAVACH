import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/Button";
import { ArchitectureExplorer } from "../components/architecture/ArchitectureExplorer";

/**
 * Public route (`/architecture`) — no login required, no dashboard
 * chrome (no sidebar/topbar). Reached from the landing page's "Explore
 * Architecture" button (components/public-landing/PublicHero.tsx).
 * Reuses ArchitectureExplorer verbatim (see pages/SystemArchitecturePage.tsx
 * for the authenticated dashboard counterpart) — only the surrounding
 * page chrome and the "Back to Home" header action differ.
 */
export default function PublicArchitecturePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <ArchitectureExplorer
        headerAction={
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="size-4" />
            Back to Home
          </Button>
        }
      />
    </div>
  );
}
