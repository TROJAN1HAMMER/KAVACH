import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import type { ArchComponent, ArchComponentId } from "../componentData";
import { CATEGORY_COLORS } from "./categoryColors";

interface ArchitectureNode3DProps {
  component: ArchComponent;
  position: THREE.Vector3;
  phase: number;
  isHub: boolean;
  isActive: boolean;
  isDimmed: boolean;
  onHoverChange: (id: ArchComponentId | null) => void;
  onSelect: (id: ArchComponentId) => void;
}

/**
 * One floating node: a low-poly rounded box (kept simple/cheap — this renders 21 times) with
 * an emissive halo shell, a gentle phase-offset idle bob, and a small DOM label anchored via
 * drei's `<Html>`. Hover/focus state is lifted to `ArchitectureScene3D` and passed down as
 * `isActive`/`isDimmed` so there's exactly one source of truth for "what's hovered" — all the
 * per-frame easing (scale, glow, dimming) happens here via refs, never React state.
 */
export function ArchitectureNode3D({
  component,
  position,
  phase,
  isHub,
  isActive,
  isDimmed,
  onHoverChange,
  onSelect,
}: ArchitectureNode3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const boxRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const scaleState = useRef(1);
  const emissiveState = useRef(0.35);
  const haloOpacityState = useRef(0.14);
  const bodyOpacityState = useRef(1);

  const colors = CATEGORY_COLORS[component.category];
  const baseSize = isHub ? 1.2 : 0.86;
  const Icon = component.icon;

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const group = groupRef.current;
    if (group) {
      group.position.set(position.x, position.y + Math.sin(t * 0.6 + phase) * 0.18, position.z);

      const targetScale = isActive ? 1.24 : 1;
      scaleState.current = THREE.MathUtils.damp(scaleState.current, targetScale, 6, delta);
      group.scale.setScalar(scaleState.current);
    }

    const targetEmissive = isActive ? 1.15 : 0.35;
    emissiveState.current = THREE.MathUtils.damp(emissiveState.current, targetEmissive, 6, delta);
    const bodyMaterial = boxRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (bodyMaterial) {
      bodyMaterial.emissiveIntensity = emissiveState.current;
      const targetOpacity = isDimmed ? 0.32 : 1;
      bodyOpacityState.current = THREE.MathUtils.damp(bodyOpacityState.current, targetOpacity, 6, delta);
      bodyMaterial.opacity = bodyOpacityState.current;
    }

    const targetHalo = (isActive ? 0.34 : 0.14) * (isDimmed ? 0.35 : 1);
    haloOpacityState.current = THREE.MathUtils.damp(haloOpacityState.current, targetHalo, 6, delta);
    const haloMaterial = haloRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (haloMaterial) haloMaterial.opacity = haloOpacityState.current;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
        onHoverChange(component.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "auto";
        onHoverChange(null);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(component.id);
      }}
    >
      <mesh ref={haloRef} scale={baseSize * 1.7}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={colors.glow}
          transparent
          opacity={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <RoundedBox ref={boxRef} args={[baseSize, baseSize, baseSize]} radius={baseSize * 0.2} smoothness={4}>
        <meshStandardMaterial
          color={colors.base}
          emissive={colors.glow}
          emissiveIntensity={0.35}
          roughness={0.4}
          metalness={0.35}
          transparent
          opacity={1}
        />
      </RoundedBox>

      <Html center distanceFactor={13} pointerEvents="none" occlude={false} zIndexRange={[20, 0]}>
        <div className="flex -translate-y-7 flex-col items-center gap-1 select-none">
          <span
            className="flex size-5 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
            style={{ color: colors.glow }}
          >
            <Icon className="size-3" />
          </span>
          <span className="whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {component.label}
          </span>
        </div>
      </Html>
    </group>
  );
}
