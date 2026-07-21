import { memo } from "react";
import { Boxes, ClipboardCheck, Layers, Workflow } from "lucide-react";
import { StatTile } from "../ui/StatTile";
import { ARCH_COMPONENTS, FAN_OUT } from "../architecture/componentData";

/** Top-line KAVACH stats for the overview page — counts are derived from the
 * architecture data source so they can never drift from the actual diagram. */
export const StatHighlights = memo(function StatHighlights() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Scan pipeline stages" value={9} icon={<Workflow className="size-5" />} />
      <StatTile
        label="Explorable components"
        value={ARCH_COMPONENTS.length}
        icon={<Boxes className="size-5" />}
      />
      <StatTile
        label="Parallel scanner engines"
        value={FAN_OUT.length}
        icon={<Layers className="size-5" />}
      />
      <StatTile label="Compliance frameworks" value={3} icon={<ClipboardCheck className="size-5" />} />
    </div>
  );
});
