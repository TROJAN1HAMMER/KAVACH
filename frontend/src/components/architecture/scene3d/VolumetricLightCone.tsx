import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface VolumetricLightConeProps {
  position: THREE.Vector3;
  color: string;
  height?: number;
  radius?: number;
}

/**
 * A cheap approximation of volumetric light shafts — a soft, additive, upward-pointing cone
 * rather than a true god-rays postprocessing pass (which needs a dedicated light-source render
 * target and is a meaningfully bigger performance cost for a "where possible" nice-to-have).
 * Disclosed as a simplification, not true volumetrics.
 */
export function VolumetricLightCone({ position, color, height = 9, radius = 2.4 }: VolumetricLightConeProps) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.05 + Math.sin(clock.getElapsedTime() * 0.4) * 0.015;
    }
  });

  return (
    <mesh position={[position.x, position.y + height / 2, position.z]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[radius, height, 24, 1, true]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.06}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
