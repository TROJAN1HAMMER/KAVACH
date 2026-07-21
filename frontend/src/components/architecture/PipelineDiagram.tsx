import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Workflow } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  CATEGORY_META,
  FAN_OUT,
  MAIN_FLOW_AFTER,
  MAIN_FLOW_BEFORE,
  getComponent,
  type ArchComponent,
  type ArchComponentId,
} from "./componentData";

interface PipelineDiagramProps {
  selectedId: ArchComponentId | null;
  onSelect: (id: ArchComponentId) => void;
}

/** How a node/connector should render relative to the currently-selected execution path. */
type PathState = "selected" | "highlighted" | "dimmed" | "neutral";

/**
 * Computes the set of node ids that make up the "upstream path" leading to `selectedId`.
 *
 * Deliberately a flat lookup over the three ordered flow arrays rather than a generic graph
 * search over `interactions` — that field exists for the detail panel's cross-links, and its
 * shape (loosely-typed, many-to-many, includes downstream/lateral notes) isn't a reliable
 * source for "what came before this node in the pipeline."
 */
function computeHighlightedIds(
  selectedId: ArchComponentId | null,
): { ids: Set<ArchComponentId>; mode: "before" | "fanout" | "storage" | "after" } | null {
  if (!selectedId) return null;

  const beforeIdx = MAIN_FLOW_BEFORE.indexOf(selectedId);
  if (beforeIdx !== -1) {
    return { ids: new Set(MAIN_FLOW_BEFORE.slice(0, beforeIdx + 1)), mode: "before" };
  }

  if (FAN_OUT.includes(selectedId)) {
    return { ids: new Set([...MAIN_FLOW_BEFORE, selectedId]), mode: "fanout" };
  }

  if (selectedId === "storage") {
    return { ids: new Set([...MAIN_FLOW_BEFORE, "storage"]), mode: "storage" };
  }

  const afterIdx = MAIN_FLOW_AFTER.indexOf(selectedId);
  if (afterIdx !== -1) {
    return {
      ids: new Set([...MAIN_FLOW_BEFORE, ...FAN_OUT, ...MAIN_FLOW_AFTER.slice(0, afterIdx + 1)]),
      mode: "after",
    };
  }

  return null;
}

function getPathState(
  id: ArchComponentId,
  selectedId: ArchComponentId | null,
  highlighted: Set<ArchComponentId> | null,
): PathState {
  if (!selectedId || !highlighted) return "neutral";
  if (id === selectedId) return "selected";
  return highlighted.has(id) ? "highlighted" : "dimmed";
}

/** A single line segment with an animated pulse traveling along it, standing in for live data flow. */
function Pulse({
  axis,
  length,
  delay = 0,
  active = false,
}: {
  axis: "x" | "y";
  length: number;
  delay?: number;
  /** Renders a brighter, faster pulse when this segment sits on the highlighted execution path. */
  active?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;
  return (
    <motion.span
      className={cn("absolute rounded-full bg-primary", active ? "size-2" : "size-1.5")}
      style={{
        boxShadow: active ? "0 0 12px var(--color-primary)" : "0 0 8px var(--color-primary)",
        top: axis === "y" ? 0 : "50%",
        left: axis === "x" ? 0 : "50%",
        x: axis === "y" ? "-50%" : 0,
        y: axis === "x" ? "-50%" : 0,
      }}
      animate={
        axis === "y"
          ? { y: [0, length], opacity: active ? [0, 1, 1, 0] : [0, 0.8, 0.8, 0] }
          : { x: [0, length], opacity: active ? [0, 1, 1, 0] : [0, 0.8, 0.8, 0] }
      }
      transition={{
        duration: active ? 0.9 : 2.2,
        repeat: Infinity,
        ease: active ? "easeInOut" : "linear",
        delay,
      }}
    />
  );
}

function VerticalConnector({
  height = 32,
  delay = 0,
  state = "neutral",
}: {
  height?: number;
  delay?: number;
  state?: PathState;
}) {
  return (
    <div
      className={cn(
        "relative flex justify-center transition-opacity duration-300",
        state === "dimmed" && "opacity-35",
      )}
      style={{ height }}
      aria-hidden
    >
      <div className={cn("h-full w-px transition-colors duration-300", state === "highlighted" || state === "selected" ? "bg-primary/60" : "bg-border")} />
      <Pulse axis="y" length={height} delay={delay} active={state === "highlighted" || state === "selected"} />
    </div>
  );
}

function HorizontalConnector({
  width = 48,
  delay = 0,
  state = "neutral",
}: {
  width?: number;
  delay?: number;
  state?: PathState;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center transition-opacity duration-300",
        state === "dimmed" && "opacity-35",
      )}
      style={{ width }}
      aria-hidden
    >
      <div className={cn("h-px w-full transition-colors duration-300", state === "highlighted" || state === "selected" ? "bg-primary/60" : "bg-border")} />
      <Pulse axis="x" length={width} delay={delay} active={state === "highlighted" || state === "selected"} />
    </div>
  );
}

/** Subtle radial glow used behind the Aggregation Layer node to suggest the 6 scanner outputs converging. */
function MergeGlow({ colorClass }: { colorClass: string }) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;
  return (
    <motion.span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 rounded-xl blur-md", colorClass)}
      animate={{ opacity: [0, 0.35, 0], scale: [0.92, 1.08, 1.16] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
    />
  );
}

function NodeCard({
  component,
  pathState,
  onSelect,
  index,
  compact,
  mergeGlow,
}: {
  component: ArchComponent;
  pathState: PathState;
  onSelect: (id: ArchComponentId) => void;
  index: number;
  compact?: boolean;
  /** Renders a soft ambient "findings converging" glow behind the card (used only for Aggregation Layer). */
  mergeGlow?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const meta = CATEGORY_META[component.category];
  const Icon = component.icon;

  return (
    <motion.div
      className="group relative"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: Math.min(index * 0.04, 0.6) }}
    >
      {mergeGlow && <MergeGlow colorClass={meta.dot} />}

      <motion.button
        type="button"
        onClick={() => onSelect(component.id)}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        title={component.tagline}
        aria-describedby={`arch-tooltip-${component.id}`}
        whileHover={shouldReduceMotion ? undefined : { scale: 1.03, y: -2 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-xl border bg-card px-4 py-3 text-center shadow-sm transition-[opacity,box-shadow,border-color] duration-300",
          "hover:shadow-md hover:ring-2",
          meta.ring,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          compact ? "w-[136px]" : "w-[176px] sm:w-[200px]",
          pathState === "selected" && cn("border-transparent ring-2", meta.ring),
          pathState === "highlighted" && cn("border-transparent ring-1 shadow-md", meta.ring, meta.glow),
          pathState === "dimmed" && "opacity-40",
        )}
      >
        <motion.span
          className={cn("flex items-center justify-center rounded-full bg-muted", compact ? "size-8" : "size-9", meta.text)}
          animate={!shouldReduceMotion && hovered ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 1.2, repeat: hovered ? Infinity : 0, ease: "easeInOut" }}
        >
          <Icon className={compact ? "size-4" : "size-5"} />
        </motion.span>
        <span className={cn("font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>{component.label}</span>
        <span className={cn("font-medium uppercase tracking-wide", compact ? "text-[9px]" : "text-[10px]", meta.text)}>
          {meta.label}
        </span>
      </motion.button>

      <div
        id={`arch-tooltip-${component.id}`}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-card p-2.5 text-xs leading-snug text-muted-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {component.tagline}
      </div>
    </motion.div>
  );
}

function StorageLink({ onSelect, label }: { onSelect: (id: ArchComponentId) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onSelect("storage")}
      className="mt-1 text-[11px] font-medium text-teal-600 underline decoration-dotted underline-offset-2 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
    >
      {label}
    </button>
  );
}

const FAN_OUT_OFFSET = MAIN_FLOW_BEFORE.length + 1;
const AFTER_OFFSET = FAN_OUT_OFFSET + FAN_OUT.length;

export function PipelineDiagram({ selectedId, onSelect }: PipelineDiagramProps) {
  const highlight = useMemo(() => computeHighlightedIds(selectedId), [selectedId]);
  const highlightedIds = highlight?.ids ?? null;
  const hasSelection = highlight !== null;
  // The fan-out region (divider pill + connecting lines) reads as "active" only when the
  // selected node is one of the 6 scanners, or something downstream of the whole fan-out.
  const fanOutSectionActive = highlight?.mode === "fanout" || highlight?.mode === "after";
  const mergeSectionActive = highlight?.mode === "after";

  return (
    <div className="overflow-x-auto">
      <div className="mx-auto flex min-w-[300px] max-w-4xl flex-col items-center px-2 pb-2">
        {/* Legend */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {(Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", CATEGORY_META[key].dot)} />
              {CATEGORY_META[key].label}
            </span>
          ))}
        </div>

        {/* Main trunk before fan-out */}
        {MAIN_FLOW_BEFORE.map((id, i) => {
          const component = getComponent(id);
          const isWorkers = id === "celery-workers";
          const nodeState = getPathState(id, selectedId, highlightedIds);
          const connectorState: PathState = highlightedIds?.has(id) ? nodeState : hasSelection ? "dimmed" : "neutral";
          const storageState: PathState = getPathState("storage", selectedId, highlightedIds);
          const storageConnectorState: PathState =
            highlight?.mode === "storage" ? "highlighted" : hasSelection ? "dimmed" : "neutral";
          return (
            <div key={id} className="flex w-full flex-col items-center">
              {i > 0 && <VerticalConnector delay={i * 0.15} state={connectorState} />}
              {isWorkers ? (
                <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <NodeCard component={component} pathState={nodeState} onSelect={onSelect} index={i} />
                  <div className="hidden sm:block">
                    <HorizontalConnector width={40} delay={0.3} state={storageConnectorState} />
                  </div>
                  <div className="sm:hidden">
                    <VerticalConnector height={24} delay={0.3} state={storageConnectorState} />
                  </div>
                  <NodeCard
                    component={getComponent("storage")}
                    pathState={storageState}
                    onSelect={onSelect}
                    index={i + 1}
                    compact
                  />
                </div>
              ) : (
                <NodeCard component={component} pathState={nodeState} onSelect={onSelect} index={i} />
              )}
            </div>
          );
        })}

        {/* Fan-out into parallel scanners */}
        <VerticalConnector delay={0.2} state={fanOutSectionActive ? "highlighted" : hasSelection ? "dimmed" : "neutral"} />
        <div
          className={cn(
            "mb-2 flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground transition-opacity duration-300",
            hasSelection && !fanOutSectionActive && "opacity-40",
          )}
        >
          <Workflow className="size-3.5" />
          Fans out to 6 parallel scanner engines
        </div>
        <div className="relative mt-1 w-full">
          <div
            className={cn(
              "mx-auto h-px w-[85%] transition-all duration-300",
              fanOutSectionActive ? "bg-primary/60" : "bg-border",
              hasSelection && !fanOutSectionActive && "opacity-40",
            )}
            aria-hidden
          />
          <div className="mt-0 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {FAN_OUT.map((id, i) => {
              const component = getComponent(id);
              const nodeState = getPathState(id, selectedId, highlightedIds);
              const tickActive = nodeState === "highlighted" || nodeState === "selected";
              return (
                <div key={id} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "relative h-4 w-px transition-opacity duration-300",
                      hasSelection && !tickActive && "opacity-40",
                    )}
                    aria-hidden
                  >
                    <div className={cn("h-full w-px", tickActive ? "bg-primary/60" : "bg-border")} />
                    <Pulse axis="y" length={16} delay={i * 0.12} active={tickActive} />
                  </div>
                  <NodeCard
                    component={component}
                    pathState={nodeState}
                    onSelect={onSelect}
                    index={FAN_OUT_OFFSET + i}
                    compact
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 w-full">
          <div
            className={cn(
              "mx-auto h-px w-[85%] transition-all duration-300",
              mergeSectionActive ? "bg-primary/60" : "bg-border",
              hasSelection && !mergeSectionActive && "opacity-40",
            )}
            aria-hidden
          />
        </div>

        {/* Main trunk after aggregation */}
        {MAIN_FLOW_AFTER.map((id, i) => {
          const component = getComponent(id);
          const isReportGen = id === "report-generator";
          const isAggregation = id === "aggregation-layer";
          const nodeState = getPathState(id, selectedId, highlightedIds);
          const connectorState: PathState = highlightedIds?.has(id) ? nodeState : hasSelection ? "dimmed" : "neutral";
          return (
            <div key={id} className="flex w-full flex-col items-center">
              <VerticalConnector delay={0.25 + i * 0.1} state={connectorState} />
              <NodeCard
                component={component}
                pathState={nodeState}
                onSelect={onSelect}
                index={AFTER_OFFSET + i}
                mergeGlow={isAggregation}
              />
              {isReportGen && <StorageLink onSelect={onSelect} label="⇄ also persists to Storage" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
