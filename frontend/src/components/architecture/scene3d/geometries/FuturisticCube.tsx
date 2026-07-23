import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import type { NodeGeometryProps } from "./types";

/** FastAPI Gateway — a beveled cube with a thin wireframe edge accent so it
 *  reads as "tech infrastructure" rather than a plain box. */
export function FuturisticCube({ size, color, glowColor }: NodeGeometryProps) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);

  return (
    <group>
      <RoundedBox args={[size * 0.82, size * 0.82, size * 0.82]} radius={size * 0.12} smoothness={4}>
        <meshStandardMaterial
          color={color}
          emissive={glowColor}
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.5}
          transparent
        />
      </RoundedBox>
      <lineSegments geometry={edges} scale={size * 0.9}>
        <lineBasicMaterial color={glowColor} transparent opacity={0.5} toneMapped={false} />
      </lineSegments>
    </group>
  );
}
