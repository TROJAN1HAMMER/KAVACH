import * as THREE from "three";
import { FAN_OUT, MAIN_FLOW_AFTER, MAIN_FLOW_BEFORE, type ArchComponentId } from "../componentData";

export interface NodeLayout {
  position: THREE.Vector3;
  /** Deterministic per-node phase offset (radians) so idle bob animations don't sync up. */
  phase: number;
}

export type ArchitectureLayout = Record<ArchComponentId, NodeLayout>;

// Tunable constants for the whole scene's geometry — kept together and named so the overall
// footprint can be nudged without hunting through the layout math below.
const TRUNK_SPACING = 2.6;
const WAVE_Z_AMPLITUDE = 3.2;
const WAVE_Y_AMPLITUDE = 1.3;
const RING_RADIUS = 5.6;
const RING_FORWARD_OFFSET = 2.6;

/** Radians/second the 6 scanners drift around the hub — slow enough to read as ambient motion,
 *  not a spinning carousel (a full revolution takes roughly two minutes). */
export const SCANNER_ORBIT_SPEED = 0.05;

export const HUB_ID: ArchComponentId = "celery-workers";

/** Small deterministic hash so per-node jitter/phase is stable across renders without storing
 *  extra state or touching `componentData.ts`. */
export function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function phaseFor(id: string): number {
  return ((hashId(id) % 1000) / 1000) * Math.PI * 2;
}

/**
 * Angle (radians, standard unit-circle) for each of the 6 FAN_OUT scanners around the hub,
 * arranged as a hexagon matching the brief's ASCII layout: Semgrep at the top, Joern/AST-Grep
 * on the upper shoulders, Secrets-Detection/Dependency-Analysis on the lower shoulders, and
 * Configuration Scanner at the bottom.
 */
export const RING_ANGLES: Partial<Record<ArchComponentId, number>> = {
  semgrep: Math.PI / 2,
  "ast-grep": Math.PI / 6,
  joern: (Math.PI * 5) / 6,
  "dependency-analysis": -Math.PI / 6,
  "secrets-detection": -(Math.PI * 5) / 6,
  "configuration-scanner": -Math.PI / 2,
};

/**
 * Pure function computing a fixed 3D position + idle-bob phase for every one of the 21
 * architecture nodes. The main pipeline (`MAIN_FLOW_BEFORE` -> `MAIN_FLOW_AFTER`) runs along a
 * gentle S-curve on the X axis (a sine/cosine wave on Z/Y rather than a rigid straight line);
 * `storage` sits as a satellite beside the hub (`celery-workers`), mirroring its role in the
 * 2D diagram; the 6 `FAN_OUT` scanners ring the hub in a hexagon, one ring position per the
 * brief's ASCII sketch.
 *
 * Deliberately a pure function (no React/Three side effects) so it's trivial to memoize once
 * per mount and to unit-reason about independent of rendering.
 */
export function computeArchitectureLayout(): ArchitectureLayout {
  const layout = {} as ArchitectureLayout;
  const trunk: ArchComponentId[] = [...MAIN_FLOW_BEFORE, ...MAIN_FLOW_AFTER];
  const hubIndex = MAIN_FLOW_BEFORE.length - 1; // celery-workers is the last "before" node

  trunk.forEach((id, i) => {
    const t = i - hubIndex;
    const x = t * TRUNK_SPACING;
    const z = Math.sin(i * 0.7) * WAVE_Z_AMPLITUDE;
    // Flatten the hub's own bob baseline slightly so it reads as the stable center the ring
    // surrounds, rather than another wave crest.
    const y = Math.cos(i * 0.5) * WAVE_Y_AMPLITUDE * (i === hubIndex ? 0.3 : 1);
    layout[id] = { position: new THREE.Vector3(x, y, z), phase: phaseFor(id) };
  });

  const hub = layout[HUB_ID].position;

  FAN_OUT.forEach((id) => {
    const angle = RING_ANGLES[id] ?? 0;
    const jitter = ((hashId(id) % 5) - 2) * 0.25;
    const x = hub.x + Math.cos(angle) * RING_RADIUS;
    const y = hub.y + Math.sin(angle) * RING_RADIUS * 0.62;
    const z = hub.z + RING_FORWARD_OFFSET + jitter;
    layout[id] = { position: new THREE.Vector3(x, y, z), phase: phaseFor(id) };
  });

  layout.storage = {
    position: new THREE.Vector3(hub.x - 1.7, hub.y - 2.5, hub.z + 1.9),
    phase: phaseFor("storage"),
  };

  return layout;
}

/**
 * Live position for one of the 6 `FAN_OUT` scanners at a given elapsed time — the exact same
 * ring formula `computeArchitectureLayout` uses at t=0, plus a slow constant angular drift, so
 * mount-time position matches perfectly and then eases into the orbit. Writes into `target`
 * in place (rather than allocating a new `Vector3` every frame) so callers can pass the same
 * mutable `layout[id].position` object every node/edge already holds a reference to — nothing
 * downstream needs to know positions are now time-varying for these 6 ids.
 */
export function computeScannerOrbitPosition(
  id: ArchComponentId,
  hub: THREE.Vector3,
  elapsed: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  const angle = (RING_ANGLES[id] ?? 0) + elapsed * SCANNER_ORBIT_SPEED;
  const jitter = ((hashId(id) % 5) - 2) * 0.25;
  const x = hub.x + Math.cos(angle) * RING_RADIUS;
  const y = hub.y + Math.sin(angle) * RING_RADIUS * 0.62;
  const z = hub.z + RING_FORWARD_OFFSET + jitter;
  return target.set(x, y, z);
}
