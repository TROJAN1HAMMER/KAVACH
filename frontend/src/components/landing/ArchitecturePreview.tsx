import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { PipelineDiagram } from "../architecture/PipelineDiagram";
import { ComponentDetailPanel } from "../architecture/ComponentDetailPanel";
import { ARCH_COMPONENTS, FAN_OUT, type ArchComponentId } from "../architecture/componentData";

/**
 * A "taste" of the full System Architecture explorer, embedded on the
 * overview page. Wires up `PipelineDiagram` + `ComponentDetailPanel` with
 * the exact same local-state pattern `SystemArchitecturePage` uses — those
 * components are owned elsewhere and treated as a black box here.
 *
 * The diagram itself can be tall, so it's clipped to a fixed-height,
 * scroll-free window with a bottom gradient fade and a clear link through
 * to the full page, rather than altering the diagram's own layout.
 */
export const ArchitecturePreview = memo(function ArchitecturePreview() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<ArchComponentId | null>(null);

  return (
    <Card>
      <CardHeader
        title="Interactive architecture preview"
        description={`${ARCH_COMPONENTS.length} explorable components across the full scan lifecycle, including ${FAN_OUT.length} parallel scanner engines — click any node for detail, or open the full explorer below.`}
      />
      <CardContent>
        <div className="relative max-h-[520px] overflow-hidden rounded-lg">
          <PipelineDiagram selectedId={selectedId} onSelect={setSelectedId} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent"
          />
        </div>

        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => navigate("/architecture")}>
            View full architecture
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>

      <ComponentDetailPanel
        componentId={selectedId}
        onClose={() => setSelectedId(null)}
        onNavigate={setSelectedId}
      />
    </Card>
  );
});
