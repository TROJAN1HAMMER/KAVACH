import type { NodeGeometryProps } from "./types";

/** Scan Orchestrator — a faceted octahedron; reads as a "dispatch" node
 *  distinct from the hub it hands work off to. */
export function Octahedron({ size, color, glowColor }: NodeGeometryProps) {
  return (
    <mesh rotation={[0, Math.PI / 6, 0]}>
      <octahedronGeometry args={[size * 0.62, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.45}
        roughness={0.3}
        metalness={0.4}
        transparent
      />
    </mesh>
  );
}
