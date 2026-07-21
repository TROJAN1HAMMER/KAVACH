import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";

/**
 * Subtle depth cues behind the node network: a faint drifting grid plane below the scene plus
 * a sparse particle field. Deliberately low-key/dark — this must never compete with the nodes
 * and connections for attention, so opacity/counts are kept modest.
 */
export function ArchitectureBackground3D() {
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
      <Sparkles count={70} scale={[48, 22, 32]} size={1.4} speed={0.15} opacity={0.25} color="#5b8def" />
    </group>
  );
}
