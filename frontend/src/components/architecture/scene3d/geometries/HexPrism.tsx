import type { NodeGeometryProps } from "./types";

/** Distributed Workers hub — a large hexagonal prism (a `cylinderGeometry` with 6 radial
 *  segments); the 6 scanner modules reuse this exact silhouette at a smaller scale. */
export function HexPrism({ size, color, glowColor }: NodeGeometryProps) {
  return (
    <mesh>
      <cylinderGeometry args={[size * 0.68, size * 0.68, size * 0.5, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.5}
        roughness={0.3}
        metalness={0.5}
        transparent
      />
    </mesh>
  );
}
