import { useMemo } from "react";
import * as THREE from "three";
import type { NodeGeometryProps } from "./types";

function buildShieldShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1);
  shape.quadraticCurveTo(0.82, 0.72, 0.78, 0.08);
  shape.quadraticCurveTo(0.72, -0.62, 0, -1.05);
  shape.quadraticCurveTo(-0.72, -0.62, -0.78, 0.08);
  shape.quadraticCurveTo(-0.82, 0.72, 0, 1);
  return shape;
}

interface ShieldProps extends NodeGeometryProps {
  /** Lets Authentication and Compliance Engine share the same silhouette
   *  while reading as distinct objects (Compliance's is flatter/wider). */
  aspect?: number;
}

/** Authentication / Compliance Engine — an extruded shield silhouette
 *  (a `THREE.Shape`, not a primitive) with a soft bevel. */
export function Shield({ size, color, glowColor, aspect = 1 }: ShieldProps) {
  const geometry = useMemo(() => {
    const shape = buildShieldShape();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.045,
      bevelSegments: 3,
      curveSegments: 14,
    });
    geo.center();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} scale={[size * 0.62 * aspect, size * 0.62, size * 0.62]} rotation={[0, 0, 0]}>
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.5}
        roughness={0.3}
        metalness={0.45}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
