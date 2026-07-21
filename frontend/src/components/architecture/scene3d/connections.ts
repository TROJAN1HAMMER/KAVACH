import * as THREE from "three";
import { FAN_OUT, MAIN_FLOW_AFTER, MAIN_FLOW_BEFORE, type ArchComponentId } from "../componentData";
import type { ArchitectureLayout } from "./useArchitectureLayout";

export interface SceneEdge {
  id: string;
  from: ArchComponentId;
  to: ArchComponentId;
  curve: THREE.QuadraticBezierCurve3;
}

const HUB: ArchComponentId = "celery-workers";
const AGGREGATION: ArchComponentId = "aggregation-layer";

/** Builds a gently-arced curve between two points (a sag/bow rather than a dead-straight
 *  line), so connections read as cables/conduits, matching `ConnectionPath3D`'s brief. */
function makeCurve(a: THREE.Vector3, b: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const span = b.clone().sub(a);
  const length = span.length();
  const mid = a.clone().add(span.multiplyScalar(0.5));
  const perpendicular = new THREE.Vector3(-span.z, 0, span.x).normalize();
  mid.add(perpendicular.multiplyScalar(length * 0.08));
  mid.y += length * 0.16 + 0.5;
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

/**
 * Builds the fixed set of connections rendered in the 3D scene, mirroring exactly the edges
 * `PipelineDiagram.tsx` draws: the `MAIN_FLOW_BEFORE` chain, the hub<->storage satellite link,
 * the hub fanning out to all 6 `FAN_OUT` scanners and each converging back to the aggregation
 * layer, and the `MAIN_FLOW_AFTER` chain. Deliberately built from those three ordered arrays
 * rather than the richer `interactions` graph on each component (see `pathHighlight.ts`).
 */
export function buildEdges(layout: ArchitectureLayout): SceneEdge[] {
  const edges: SceneEdge[] = [];
  const add = (from: ArchComponentId, to: ArchComponentId) => {
    edges.push({ id: `${from}->${to}`, from, to, curve: makeCurve(layout[from].position, layout[to].position) });
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
