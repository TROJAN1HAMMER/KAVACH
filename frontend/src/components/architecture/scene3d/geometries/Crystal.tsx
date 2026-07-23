import { MeshTransmissionMaterial } from "@react-three/drei";
import type { NodeGeometryProps } from "./types";

/** Business Risk Score Engine — a refractive glass gem (drei's
 *  `MeshTransmissionMaterial`). Only ever mounted once in the whole scene,
 *  so the extra render pass it costs is negligible. */
export function Crystal({ size, color, glowColor }: NodeGeometryProps) {
  return (
    <mesh scale={[size * 0.48, size * 0.72, size * 0.48]}>
      <octahedronGeometry args={[1, 0]} />
      <MeshTransmissionMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.35}
        thickness={0.6}
        roughness={0.08}
        transmission={1}
        ior={1.4}
        chromaticAberration={0.04}
        anisotropy={0.1}
        distortion={0.12}
        distortionScale={0.25}
        temporalDistortion={0.1}
        toneMapped={false}
      />
    </mesh>
  );
}
