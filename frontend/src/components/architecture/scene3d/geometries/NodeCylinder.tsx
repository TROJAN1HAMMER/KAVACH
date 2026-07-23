import type { NodeGeometryProps } from "./types";

/** Webhook Receiver — a short upright cylinder, read as a connector/post. */
export function NodeCylinder({ size, color, glowColor }: NodeGeometryProps) {
  return (
    <mesh>
      <cylinderGeometry args={[size * 0.4, size * 0.46, size * 0.68, 28]} />
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.45}
        roughness={0.35}
        metalness={0.4}
        transparent
      />
    </mesh>
  );
}
