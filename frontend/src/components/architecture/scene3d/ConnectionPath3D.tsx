import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Line2, LineSegments2 } from "three-stdlib";
import { LINE_COLOR, LINE_COLOR_HIGHLIGHT } from "./categoryColors";

interface ConnectionPath3DProps {
  curve: THREE.QuadraticBezierCurve3;
  isHighlighted: boolean;
  isDimmed: boolean;
  /** True for the 12 edges touching an orbiting scanner — see `connections.ts`'s `SceneEdge`.
   *  These re-derive their line's points from `curve` every frame (the scene's orbit driver
   *  rewrites `curve`'s control points in place before this runs) instead of relying on the
   *  one-time `points` memo below. */
  isDynamic?: boolean;
}

const SEGMENTS = 24;

function flattenPoints(points: THREE.Vector3[]): number[] {
  const flat: number[] = new Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    flat[i * 3] = points[i].x;
    flat[i * 3 + 1] = points[i].y;
    flat[i * 3 + 2] = points[i].z;
  }
  return flat;
}

/**
 * One curved connection between two nodes, rendered as a thin glowing line with a gentle
 * arc/sag (built in `connections.ts`) rather than a dead-straight segment. Opacity/color ease
 * (via refs + `useFrame`, never React state) between idle / highlighted / dimmed depending on
 * whether the currently hovered-or-focused node's upstream path includes this edge.
 */
export function ConnectionPath3D({ curve, isHighlighted, isDimmed, isDynamic = false }: ConnectionPath3DProps) {
  const points = useMemo(() => curve.getPoints(SEGMENTS), [curve]);
  const lineRef = useRef<Line2 | LineSegments2>(null);
  const opacityState = useRef(0.22);
  const colorMixState = useRef(0);
  const baseColor = useMemo(() => new THREE.Color(LINE_COLOR), []);
  const highlightColor = useMemo(() => new THREE.Color(LINE_COLOR_HIGHLIGHT), []);

  useFrame((_, delta) => {
    if (isDynamic) {
      // `curve`'s control points were just rewritten in place this frame (see
      // `ArchitectureScene3D`'s orbit driver) — re-derive this line's geometry from them
      // directly, bypassing React entirely, the same way `DataPackets3D` already reads
      // `curve.getPointAt(t)` fresh every frame.
      const geometry = lineRef.current?.geometry as { setPositions?: (array: number[]) => void } | undefined;
      geometry?.setPositions?.(flattenPoints(curve.getPoints(SEGMENTS)));
    }

    const targetOpacity = isHighlighted ? 0.95 : isDimmed ? 0.06 : 0.22;
    opacityState.current = THREE.MathUtils.damp(opacityState.current, targetOpacity, 6, delta);

    const targetMix = isHighlighted ? 1 : 0;
    colorMixState.current = THREE.MathUtils.damp(colorMixState.current, targetMix, 6, delta);

    const material = lineRef.current?.material as (THREE.Material & { opacity: number; color: THREE.Color }) | undefined;
    if (material) {
      material.opacity = opacityState.current;
      material.color.copy(baseColor).lerp(highlightColor, colorMixState.current);
    }
  });

  return (
    <Line
      ref={lineRef}
      points={points}
      color={LINE_COLOR}
      transparent
      opacity={0.22}
      lineWidth={1.1}
      toneMapped={false}
    />
  );
}
