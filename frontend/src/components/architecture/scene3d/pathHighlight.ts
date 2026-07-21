import { FAN_OUT, MAIN_FLOW_AFTER, MAIN_FLOW_BEFORE, type ArchComponentId } from "../componentData";

export type HighlightMode = "before" | "fanout" | "storage" | "after";

export interface HighlightResult {
  ids: Set<ArchComponentId>;
  mode: HighlightMode;
}

/**
 * Computes the "upstream path" of node ids leading to `activeId` — the same idea as
 * `PipelineDiagram.tsx`'s `computeHighlightedIds`, reimplemented here (rather than imported)
 * so that file stays byte-for-byte untouched as the 2D fallback. See its comment for why this
 * is a flat lookup over the three ordered flow arrays rather than a generic graph search over
 * `interactions`.
 */
export function computeUpstreamPath(activeId: ArchComponentId | null): HighlightResult | null {
  if (!activeId) return null;

  const beforeIdx = MAIN_FLOW_BEFORE.indexOf(activeId);
  if (beforeIdx !== -1) {
    return { ids: new Set(MAIN_FLOW_BEFORE.slice(0, beforeIdx + 1)), mode: "before" };
  }

  if (FAN_OUT.includes(activeId)) {
    return { ids: new Set([...MAIN_FLOW_BEFORE, activeId]), mode: "fanout" };
  }

  if (activeId === "storage") {
    return { ids: new Set([...MAIN_FLOW_BEFORE, "storage"]), mode: "storage" };
  }

  const afterIdx = MAIN_FLOW_AFTER.indexOf(activeId);
  if (afterIdx !== -1) {
    return {
      ids: new Set([...MAIN_FLOW_BEFORE, ...FAN_OUT, ...MAIN_FLOW_AFTER.slice(0, afterIdx + 1)]),
      mode: "after",
    };
  }

  return null;
}
