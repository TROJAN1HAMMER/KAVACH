import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import type { QualityTier } from "./useQualityTier";

interface ArchitectureBackground3DProps {
  tier: QualityTier;
}

const SPARKLE_COUNT: Record<QualityTier, number> = { desktop: 70, tablet: 40, mobile: 22 };
const STAR_COUNT: Record<QualityTier, number> = { desktop: 2200, tablet: 1200, mobile: 500 };

/**
 * Subtle depth cues behind the node network: a faint drifting grid plane, a sparse near
 * particle field, and a distant drifting starfield layer for extra depth. Deliberately
 * low-key/dark — this must never compete with the nodes and connections for attention, so
 * opacity/counts are kept modest and scale down further on smaller/slower devices.
 */
export function ArchitectureBackground3D({ tier }: ArchitectureBackground3DProps) {
  const gridRef = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const material = grid.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.16;
    material.depthWrite = false;
  }, []);

  useFrame((_, delta) => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.position.z = ((grid.position.z + delta * 0.12) % 4) - 4;
  });

  return (
    <group>
      <gridHelper ref={gridRef} args={[140, 56, "#25324a", "#1a2233"]} position={[0, -9.5, 0]} />
      <Sparkles count={SPARKLE_COUNT[tier]} scale={[48, 22, 32]} size={1.4} speed={0.15} opacity={0.25} color="#5b8def" />
      <Stars radius={90} depth={50} count={STAR_COUNT[tier]} factor={2.2} saturation={0} fade speed={0.4} />
    </group>
  );
}
