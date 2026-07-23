import type { NodeGeometryProps } from "./types";

/** Aggregation Layer — a dodecahedron; many flat facets read as "many
 *  scanner outputs converging into one merged shape." */
export function Dodecahedron({ size, color, glowColor }: NodeGeometryProps) {
  return (
    <mesh rotation={[0.4, 0.3, 0]}>
      <dodecahedronGeometry args={[size * 0.58, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.45}
        roughness={0.35}
        metalness={0.35}
        transparent
      />
    </mesh>
  );
}
