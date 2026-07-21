import type { ReactNode } from "react";
import { Boxes, GitBranch, Layers } from "lucide-react";
import { PageHeader } from "../ui/PageHeader";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { StatTile } from "../ui/StatTile";
import { ArchitectureSceneSection } from "./ArchitectureSceneSection";
import { ARCH_COMPONENTS, FAN_OUT } from "./componentData";

/**
 * The full architecture-exploration content (stat tiles + the 3D scene),
 * shared verbatim between the public route (`/architecture`, no login,
 * no dashboard chrome) and the authenticated dashboard route
 * (`/dashboard/architecture`, rendered inside AppShell) — see
 * pages/PublicArchitecturePage.tsx and pages/SystemArchitecturePage.tsx.
 * Neither page duplicates this markup; both just wrap it in their own
 * chrome and an optional header action (e.g. a "Back to Home" button).
 */
export function ArchitectureExplorer({ headerAction }: { headerAction?: ReactNode }) {
  return (
    <div>
      <PageHeader
        title="System Architecture"
        description="An interactive 3D tour of KAVACH's full scan pipeline — drag to orbit, hover a node for details, or click one to fly the camera in."
        action={headerAction}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Explorable components"
          value={ARCH_COMPONENTS.length}
          icon={<Boxes className="size-5" />}
        />
        <StatTile label="Parallel scanner engines" value={FAN_OUT.length} icon={<Layers className="size-5" />} />
        <StatTile label="Supported Git providers" value={3} icon={<GitBranch className="size-5" />} />
      </div>

      <Card>
        <CardHeader
          title="Scan lifecycle"
          description="Hover any node for purpose, I/O, technologies, and a sample API call — click to focus the camera on it. Falls back to a 2D flowchart automatically if 3D isn't available."
        />
        <CardContent>
          <ArchitectureSceneSection />
        </CardContent>
      </Card>
    </div>
  );
}
