import type { NodeGeometryProps } from "./types";

/** Report Generator — a thin, gently tilted card, read as a floating
 *  document rather than a structural/compute shape. */
export function DocumentPlane({ size, color, glowColor }: NodeGeometryProps) {
  return (
    <group rotation={[-0.22, 0.32, 0.06]}>
      <mesh>
        <boxGeometry args={[size * 0.6, size * 0.8, size * 0.05]} />
        <meshStandardMaterial
          color={color}
          emissive={glowColor}
          emissiveIntensity={0.35}
          roughness={0.5}
          metalness={0.1}
          transparent
        />
      </mesh>
      {/* Folded-corner accent, the classic "document" tell. */}
      <mesh position={[size * 0.19, size * 0.29, size * 0.03]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[size * 0.17, size * 0.17, size * 0.052]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.5} roughness={0.4} transparent />
      </mesh>
    </group>
  );
}
