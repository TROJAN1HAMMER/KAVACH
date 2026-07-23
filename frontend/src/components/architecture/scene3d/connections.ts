import * as THREE from "three";
import { FAN_OUT, MAIN_FLOW_AFTER, MAIN_FLOW_BEFORE, type ArchComponentId } from "../componentData";
import type { ArchitectureLayout } from "./useArchitectureLayout";

export interface SceneEdge {
  id: string;
  from: ArchComponentId;
  to: ArchComponentId;
  curve: THREE.QuadraticBezierCurve3;
  /** True for the 12 edges touching one of the 6 orbiting scanners (hub->scanner,
   *  scanner->aggregation) — their curve's control points get rewritten in place every frame
   *  by the scene's orbit driver, instead of being computed once and left alone like the
   *  other 13 (trunk + hub<->storage) edges. */
  isDynamic: boolean;
}

const HUB: ArchComponentId = "celery-workers";
const AGGREGATION: ArchComponentId = "aggregation-layer";

/** The sag/bow midpoint offset for a cable arcing between two points — shared by both the
 *  one-time curve constructor below and the per-frame in-place updater so a moving endpoint
 *  gets exactly the same arc shape a static one would. */
function computeMidpoint(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const span = b.clone().sub(a);
  const length = span.length();
  out.copy(a).add(span.clone().multiplyScalar(0.5));
  const perpendicular = new THREE.Vector3(-span.z, 0, span.x).normalize();
  out.add(perpendicular.multiplyScalar(length * 0.08));
  out.y += length * 0.16 + 0.5;
  return out;
}

/** Builds a gently-arced curve between two points (a sag/bow rather than a dead-straight
 *  line), so connections read as cables/conduits, matching `ConnectionPath3D`'s brief. */
export function makeCurve(a: THREE.Vector3, b: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = computeMidpoint(a, b, new THREE.Vector3());
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
}

/** Rewrites an existing curve's three control points in place from a (possibly moved) pair of
 *  endpoints — used every frame for the 12 `isDynamic` edges instead of allocating a fresh
 *  curve, so `DataPackets3D`'s per-frame `curve.getPointAt(t)` calls automatically pick up the
 *  new shape with no changes on its end. */
export function updateCurveInPlace(curve: THREE.QuadraticBezierCurve3, a: THREE.Vector3, b: THREE.Vector3): void {
  curve.v0.copy(a);
  computeMidpoint(a, b, curve.v1);
  curve.v2.copy(b);
}

/**
 * Builds the fixed set of connections rendered in the 3D scene, mirroring exactly the edges
 * `PipelineDiagram.tsx` draws: the `MAIN_FLOW_BEFORE` chain, the hub<->storage satellite link,
 * the hub fanning out to all 6 `FAN_OUT` scanners and each converging back to the aggregation
 * layer, and the `MAIN_FLOW_AFTER` chain. Deliberately built from those three ordered arrays
 * rather than the richer `interactions` graph on each component (see `pathHighlight.ts`).
 */
const FAN_OUT_SET = new Set<ArchComponentId>(FAN_OUT);

export function buildEdges(layout: ArchitectureLayout): SceneEdge[] {
  const edges: SceneEdge[] = [];
  const add = (from: ArchComponentId, to: ArchComponentId) => {
    edges.push({
      id: `${from}->${to}`,
      from,
      to,
      curve: makeCurve(layout[from].position, layout[to].position),
      isDynamic: FAN_OUT_SET.has(from) || FAN_OUT_SET.has(to),
    });
  };

  for (let i = 0; i < MAIN_FLOW_BEFORE.length - 1; i++) {
    add(MAIN_FLOW_BEFORE[i], MAIN_FLOW_BEFORE[i + 1]);
  }

  add(HUB, "storage");

  for (const scanner of FAN_OUT) {
    add(HUB, scanner);
    add(scanner, AGGREGATION);
  }

  for (let i = 0; i < MAIN_FLOW_AFTER.length - 1; i++) {
    add(MAIN_FLOW_AFTER[i], MAIN_FLOW_AFTER[i + 1]);
  }

  return edges;
}
