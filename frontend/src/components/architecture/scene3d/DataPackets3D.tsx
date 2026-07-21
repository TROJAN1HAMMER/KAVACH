import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import type { ArchComponentId } from "../componentData";
import type { SceneEdge } from "./connections";

interface DataPackets3DProps {
  edges: SceneEdge[];
  /** The node whose upstream path is currently highlighted (hovered, or focused via click). */
  activeId: ArchComponentId | null;
  highlightedIds: Set<ArchComponentId> | null;
  colorFor: (edge: SceneEdge) => string;
  packetsPerEdge?: number;
}

interface Packet {
  edge: SceneEdge;
  t0: number;
  speed: number;
  color: THREE.Color;
}

/** Minimal shape of what drei's `<Instance>` ref exposes (a `PositionMesh`, effectively a
 *  `THREE.Group` with an extra `.color`) — narrowed locally since that class isn't exported. */
interface InstanceHandle extends THREE.Object3D {
  color: THREE.Color;
}

/**
 * Every small "traveling packet" across every connection, rendered as a single instanced mesh
 * (drei's `Instances`/`Instance`) rather than one mesh per packet — the one place in this
 * scene where the repeated-element count (edges × packets-per-edge) is worth real GPU
 * instancing. Packets travel continuously on a loop (`curve.getPointAt(t)` each frame, t
 * advancing by `delta * speed`), not just on hover — the scanner fan-out is what makes
 * "parallel execution" legible, so those edges keep moving simultaneously at all times.
 * On the edges touching the active node they slow down (per the hover-interaction spec);
 * on edges along its broader upstream path they grow slightly to read as "highlighted".
 */
export function DataPackets3D({ edges, activeId, highlightedIds, colorFor, packetsPerEdge = 2 }: DataPackets3DProps) {
  const packets = useMemo<Packet[]>(() => {
    const list: Packet[] = [];
    edges.forEach((edge) => {
      for (let i = 0; i < packetsPerEdge; i++) {
        list.push({
          edge,
          t0: i / packetsPerEdge,
          speed: 0.15 + ((edge.id.length + i * 7) % 5) * 0.018,
          color: new THREE.Color(colorFor(edge)),
        });
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colorFor is stable per mount (see ArchitectureScene3D), and edges/packetsPerEdge only change once.
  }, [edges, packetsPerEdge]);

  const handles = useRef<(InstanceHandle | null)[]>([]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    packets.forEach((packet, i) => {
      const handle = handles.current[i];
      if (!handle) return;

      const touchesActive = activeId != null && (packet.edge.from === activeId || packet.edge.to === activeId);
      const onActivePath =
        highlightedIds != null && highlightedIds.has(packet.edge.from) && highlightedIds.has(packet.edge.to);
      const isDimmed = highlightedIds != null && !onActivePath;

      const speedFactor = touchesActive ? 0.22 : 1;
      const progress = (t * packet.speed * speedFactor + packet.t0) % 1;
      handle.position.copy(packet.edge.curve.getPointAt(progress));

      const targetScale = onActivePath ? 1.7 : isDimmed ? 0.5 : 1;
      const nextScale = THREE.MathUtils.damp(handle.scale.x || 1, targetScale, 6, delta);
      handle.scale.setScalar(nextScale);
    });
  });

  return (
    <Instances limit={packets.length} range={packets.length}>
      <icosahedronGeometry args={[0.09, 0]} />
      <meshBasicMaterial toneMapped={false} />
      {packets.map((packet, i) => (
        <Instance
          key={`${packet.edge.id}-${i}`}
          ref={(handle: InstanceHandle | null) => {
            handles.current[i] = handle;
          }}
          color={packet.color}
        />
      ))}
    </Instances>
  );
}
