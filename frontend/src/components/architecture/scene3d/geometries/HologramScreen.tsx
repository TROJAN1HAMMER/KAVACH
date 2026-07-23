import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { NodeGeometryProps } from "./types";

/** Small runtime-generated scanline grid, reused for the plane's texture —
 *  cheaper than a custom GLSL shader and avoids shipping an image asset. */
function buildGridTexture(color: string): THREE.CanvasTexture {
  const canvasEl = document.createElement("canvas");
  canvasEl.width = 64;
  canvasEl.height = 64;
  const ctx = canvasEl.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    for (let y = 0; y <= 64; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 5);
  return texture;
}

/** Dashboard — a translucent plane with an animated scanline texture and a
 *  glowing wire frame, reading as a holographic screen rather than a solid
 *  object. */
export function HologramScreen({ size, glowColor }: NodeGeometryProps) {
  const texture = useMemo(() => buildGridTexture(glowColor), [glowColor]);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), []);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    // Reached via the material's own ref (an effect-phase read, not a render-phase one) rather
    // than mutating the `texture` binding above by name, so the scroll animation lives entirely
    // outside render.
    const map = materialRef.current?.map;
    if (map) {
      map.offset.y -= delta * 0.22;
    }
  });

  return (
    <group>
      <mesh>
        <planeGeometry args={[size * 0.92, size * 0.64]} />
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          color={glowColor}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <lineSegments geometry={edges} scale={[size * 0.92, size * 0.64, 1]}>
        <lineBasicMaterial color={glowColor} transparent opacity={0.75} toneMapped={false} />
      </lineSegments>
    </group>
  );
}
