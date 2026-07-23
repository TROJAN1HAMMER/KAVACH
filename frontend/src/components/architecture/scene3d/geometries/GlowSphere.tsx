import type { NodeGeometryProps } from "./types";

/** Git Provider — a smooth glowing sphere, the "source of truth" the whole
 *  pipeline originates from. */
export function GlowSphere({ size, color, glowColor }: NodeGeometryProps) {
  return (
    <mesh>
      <sphereGeometry args={[size * 0.56, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.6}
        roughness={0.25}
        metalness={0.15}
        transparent
      />
    </mesh>
  );
}
