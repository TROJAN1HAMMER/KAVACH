import { useRef } from "react";
import type * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { NodeGeometryProps } from "./types";

/** AI Explanation Layer — a low-poly, faceted icosahedron spinning on two
 *  axes continuously, independent of the shared hover/select bob — reads as
 *  "always thinking," not just idly floating like every other node. */
export function RotatingIcosahedron({ size, color, glowColor }: NodeGeometryProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.x += delta * 0.32;
    mesh.rotation.y += delta * 0.48;
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[size * 0.62, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.7}
        roughness={0.25}
        metalness={0.3}
        flatShading
        transparent
      />
    </mesh>
  );
}
