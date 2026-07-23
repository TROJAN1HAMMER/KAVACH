import type { NodeGeometryProps } from "./types";

interface StackedCylindersProps extends NodeGeometryProps {
  layers?: number;
  radiusScale?: number;
  gapScale?: number;
}

/** Redis Queue / Storage — the same "stacked disc" shape, parameterized
 *  differently so a queue (few, tightly-spaced, bright discs) and a
 *  database (broader, evenly-banded stack) read as distinct objects. */
export function StackedCylinders({
  size,
  color,
  glowColor,
  layers = 3,
  radiusScale = 0.48,
  gapScale = 0.26,
}: StackedCylindersProps) {
  const radius = size * radiusScale;
  const height = size * 0.16;
  const gap = size * gapScale;
  const totalHeight = (layers - 1) * gap;

  return (
    <group>
      {Array.from({ length: layers }).map((_, index) => (
        <mesh key={index} position={[0, index * gap - totalHeight / 2, 0]}>
          <cylinderGeometry args={[radius, radius, height, 28]} />
          <meshStandardMaterial
            color={color}
            emissive={glowColor}
            emissiveIntensity={0.4}
            roughness={0.35}
            metalness={0.4}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
