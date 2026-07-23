import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { NodeGeometryProps } from "./types";

/** Notifications — a cone base with a pulsing sphere "lamp" on top and a
 *  slowly-rotating translucent sweep cone, read as a lighthouse beacon.
 *  The lamp's pulse is its own independent animation (not the shared
 *  hover/dim emissive boost every other node uses) — it still dims via
 *  opacity like everything else, it just keeps pulsing underneath that. */
export function Beacon({ size, color, glowColor }: NodeGeometryProps) {
  const sweepRef = useRef<THREE.Mesh>(null);
  const sphereMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }, delta) => {
    if (sweepRef.current) {
      sweepRef.current.rotation.y += delta * 1.3;
    }
    if (sphereMaterialRef.current) {
      const pulse = 0.5 + Math.sin(clock.getElapsedTime() * 3) * 0.35;
      sphereMaterialRef.current.emissiveIntensity = 0.5 + pulse;
    }
  });

  return (
    <group>
      <mesh position={[0, -size * 0.14, 0]}>
        <coneGeometry args={[size * 0.4, size * 0.48, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={glowColor}
          emissiveIntensity={0.4}
          roughness={0.4}
          metalness={0.3}
          transparent
        />
      </mesh>
      <mesh position={[0, size * 0.28, 0]}>
        <sphereGeometry args={[size * 0.22, 20, 20]} />
        <meshStandardMaterial
          ref={sphereMaterialRef}
          color={color}
          emissive={glowColor}
          emissiveIntensity={0.8}
          roughness={0.2}
          transparent
        />
      </mesh>
      <mesh ref={sweepRef} position={[0, size * 0.28, 0]}>
        <coneGeometry args={[size * 0.5, size * 0.15, 24, 1, true]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
