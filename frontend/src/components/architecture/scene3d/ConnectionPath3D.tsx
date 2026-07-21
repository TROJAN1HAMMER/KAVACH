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
}

const SEGMENTS = 24;

/**
 * One curved connection between two nodes, rendered as a thin glowing line with a gentle
 * arc/sag (built in `connections.ts`) rather than a dead-straight segment. Opacity/color ease
 * (via refs + `useFrame`, never React state) between idle / highlighted / dimmed depending on
 * whether the currently hovered-or-focused node's upstream path includes this edge.
 */
export function ConnectionPath3D({ curve, isHighlighted, isDimmed }: ConnectionPath3DProps) {
  const points = useMemo(() => curve.getPoints(SEGMENTS), [curve]);
  const lineRef = useRef<Line2 | LineSegments2>(null);
  const opacityState = useRef(0.22);
  const colorMixState = useRef(0);
  const baseColor = useMemo(() => new THREE.Color(LINE_COLOR), []);
  const highlightColor = useMemo(() => new THREE.Color(LINE_COLOR_HIGHLIGHT), []);

  useFrame((_, delta) => {
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
