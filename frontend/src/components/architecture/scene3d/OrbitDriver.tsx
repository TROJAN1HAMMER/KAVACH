import { useFrame } from "@react-three/fiber";
import { FAN_OUT } from "../componentData";
import type { SceneEdge } from "./connections";
import { updateCurveInPlace } from "./connections";
import { HUB_ID, computeScannerOrbitPosition, type ArchitectureLayout } from "./useArchitectureLayout";

interface OrbitDriverProps {
  layout: ArchitectureLayout;
  edges: SceneEdge[];
}

/**
 * No visual output — purely a per-frame side effect, and the single place that makes the 6
 * scanner nodes actually orbit the hub. Must mount (and therefore register its `useFrame`)
 * before anything that reads scanner positions/edge curves this same frame, so it's rendered
 * as the very first child of the `<Canvas>` in `ArchitectureScene3D` (R3F runs same-priority
 * `useFrame` callbacks in subscription order, which follows mount order).
 *
 * Mutates two things in place every frame, never allocating new objects:
 *   1. Each `FAN_OUT` scanner's position (the same `Vector3` its `ArchitectureNode3D` and any
 *      open tooltip already hold a reference to — see `computeScannerOrbitPosition`'s docstring).
 *   2. The 12 `isDynamic` edges' curve control points, so `ConnectionPath3D`'s line geometry and
 *      `DataPackets3D`'s `curve.getPointAt(t)` calls automatically follow the moving scanner
 *      with no changes needed on their end.
 */
export function OrbitDriver({ layout, edges }: OrbitDriverProps) {
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const hub = layout[HUB_ID].position;

    for (const id of FAN_OUT) {
      computeScannerOrbitPosition(id, hub, elapsed, layout[id].position);
    }

    for (const edge of edges) {
      if (edge.isDynamic) {
        updateCurveInPlace(edge.curve, layout[edge.from].position, layout[edge.to].position);
      }
    }
  });

  return null;
}
