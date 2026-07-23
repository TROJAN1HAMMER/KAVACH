import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { ArchComponent, ArchComponentId } from "../componentData";
import { CATEGORY_COLORS } from "./categoryColors";
import { NODE_GEOMETRY } from "./geometries";
import { HoverTooltip } from "./HoverTooltip";

interface ArchitectureNode3DProps {
  component: ArchComponent;
  position: THREE.Vector3;
  phase: number;
  isHub: boolean;
  /** True while either hovered or focused — drives the shared scale/emissive boost. */
  isActive: boolean;
  /** True only while genuinely hovered — gates the nested `HoverTooltip` specifically, so
   *  clicking a node (which also sets `isActive`) doesn't leave the hover tooltip stuck open. */
  isHovered: boolean;
  isDimmed: boolean;
  onHoverChange: (id: ArchComponentId | null) => void;
  onSelect: (id: ArchComponentId) => void;
}

interface TrackedMaterial {
  material: THREE.Material;
  /** Each shape authors its own idle opacity/emissive (a wireframe accent at 0.5, a hologram
   *  plane at 0.55, a solid body at 1) — captured the first time this material is seen so the
   *  hover/dim easing below scales *relative* to each material's own look instead of stomping
   *  every material to one shared absolute value. */
  baseOpacity: number;
  baseEmissive: number;
}

function hasEmissiveIntensity(
  material: THREE.Material,
): material is THREE.Material & { emissiveIntensity: number } {
  return "emissiveIntensity" in material;
}

function collectMaterials(root: THREE.Object3D, into: Map<THREE.Material, TrackedMaterial>) {
  root.traverse((object) => {
    const maybeMaterial = (object as THREE.Mesh | THREE.LineSegments).material;
    if (!maybeMaterial) return;
    const materials = Array.isArray(maybeMaterial) ? maybeMaterial : [maybeMaterial];
    for (const material of materials) {
      if (into.has(material)) continue;
      const opacity = "opacity" in material ? (material as { opacity: number }).opacity : 1;
      const emissive = hasEmissiveIntensity(material) ? material.emissiveIntensity : 0;
      into.set(material, { material, baseOpacity: opacity, baseEmissive: emissive });
    }
  });
}

/**
 * One floating node: real geometry looked up from `NODE_GEOMETRY` by id (a sphere, a shield, a
 * crystal — whatever that node represents) plus an emissive halo shell, a gentle phase-offset
 * idle bob, and a small DOM label anchored via drei's `<Html>`. Hover/focus state is lifted to
 * `ArchitectureScene3D` and passed down as `isActive`/`isDimmed` so there's exactly one source
 * of truth for "what's hovered" — all the per-frame easing (scale, glow, dimming) happens here
 * via refs, never React state.
 *
 * The geometry components themselves don't report their materials back up via a callback prop
 * (an earlier version did this, but React's "no ref access during render" check flags passing
 * a ref-closing function into a function that's invoked during render, even though the ref
 * itself is only ever read later). Instead, `bodyGroupRef` is traversed once materials exist
 * (inside `useFrame`, never render) to discover them — the halo mesh lives in its own separate
 * `<mesh>`, outside this group, so it isn't swept up and double-managed.
 */
export function ArchitectureNode3D({
  component,
  position,
  phase,
  isHub,
  isActive,
  isHovered,
  isDimmed,
  onHoverChange,
  onSelect,
}: ArchitectureNode3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const scaleState = useRef(1);
  const emissiveBoostState = useRef(1);
  const opacityFactorState = useRef(1);
  const haloOpacityState = useRef(0.14);
  const trackedMaterials = useRef<Map<THREE.Material, TrackedMaterial>>(new Map());

  const colors = CATEGORY_COLORS[component.category];
  const baseSize = isHub ? 1.35 : 0.95;
  const Icon = component.icon;
  const renderGeometry = NODE_GEOMETRY[component.id];

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const group = groupRef.current;
    if (group) {
      group.position.set(position.x, position.y + Math.sin(t * 0.6 + phase) * 0.18, position.z);

      const targetScale = isActive ? 1.22 : 1;
      scaleState.current = THREE.MathUtils.damp(scaleState.current, targetScale, 6, delta);
      group.scale.setScalar(scaleState.current);
    }

    if (trackedMaterials.current.size === 0 && bodyGroupRef.current) {
      collectMaterials(bodyGroupRef.current, trackedMaterials.current);
    }

    const targetEmissiveBoost = isActive ? 2.4 : isDimmed ? 0.55 : 1;
    emissiveBoostState.current = THREE.MathUtils.damp(emissiveBoostState.current, targetEmissiveBoost, 6, delta);

    const targetOpacityFactor = isDimmed ? 0.3 : 1;
    opacityFactorState.current = THREE.MathUtils.damp(opacityFactorState.current, targetOpacityFactor, 6, delta);

    trackedMaterials.current.forEach(({ material, baseOpacity, baseEmissive }) => {
      if ("opacity" in material) {
        (material as { opacity: number }).opacity = baseOpacity * opacityFactorState.current;
      }
      if (hasEmissiveIntensity(material) && baseEmissive > 0) {
        material.emissiveIntensity = baseEmissive * emissiveBoostState.current;
      }
    });

    const targetHalo = (isActive ? 0.36 : 0.14) * (isDimmed ? 0.3 : 1);
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
          toneMapped={false}
        />
      </mesh>

      <group ref={bodyGroupRef}>{renderGeometry({ size: baseSize, color: colors.base, glowColor: colors.glow })}</group>

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

      {/* Nested (not anchored by a separately-tracked position) specifically so this keeps
          following the node's own live position every frame — matters for the 6 orbiting
          scanners, see this component's docstring and `HoverTooltip`'s. */}
      {isHovered && <HoverTooltip component={component} />}
    </group>
  );
}
