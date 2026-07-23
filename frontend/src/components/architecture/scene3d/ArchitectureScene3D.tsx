import { useCallback, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { RotateCcw } from "lucide-react";
import { Button } from "../../ui/Button";
import { ARCH_COMPONENTS, getComponent, type ArchComponentId } from "../componentData";
import { CATEGORY_COLORS, SCENE_BACKGROUND } from "./categoryColors";
import { computeArchitectureLayout, HUB_ID } from "./useArchitectureLayout";
import { buildEdges, type SceneEdge } from "./connections";
import { computeUpstreamPath } from "./pathHighlight";
import { ArchitectureNode3D } from "./ArchitectureNode3D";
import { ConnectionPath3D } from "./ConnectionPath3D";
import { DataPackets3D } from "./DataPackets3D";
import { NodeSidePanel } from "./NodeSidePanel";
import { ArchitectureBackground3D } from "./ArchitectureBackground3D";
import { VolumetricLightCone } from "./VolumetricLightCone";
import { SceneEffects } from "./SceneEffects";
import { OrbitDriver } from "./OrbitDriver";
import { useQualityTier } from "./useQualityTier";
import { CameraRig } from "./CameraRig";

const REST_POSITION = new THREE.Vector3(2, 9.5, 25);
const REST_TARGET = new THREE.Vector3(1, 0.5, 0);
const INTRO_START_POSITION = new THREE.Vector3(-6, 21, 54);

function colorForEdge(edge: SceneEdge): string {
  return CATEGORY_COLORS[getComponent(edge.to).category].glow;
}

/**
 * The `<Canvas>` root: camera, lighting, background, and every child layer (nodes, connections,
 * packets, the side panel, camera rig, postprocessing). Owns the single source of truth for
 * "currently hovered/focused node" so highlighting logic lives in one place instead of being
 * duplicated per child.
 */
export function ArchitectureScene3D() {
  const tier = useQualityTier();
  const layout = useMemo(() => computeArchitectureLayout(), []);
  const edges = useMemo(() => buildEdges(layout), [layout]);

  const [hoveredId, setHoveredId] = useState<ArchComponentId | null>(null);
  const [focusedId, setFocusedId] = useState<ArchComponentId | null>(null);
  // Bumped by the "Reset View" button — CameraRig treats any change (not the value itself) as
  // "fly back to the rest pose now." The only two things that ever move the camera
  // automatically: a new node focus (below) or this.
  const [resetSignal, setResetSignal] = useState(0);

  const activeId = hoveredId ?? focusedId;
  const highlight = useMemo(() => computeUpstreamPath(activeId), [activeId]);
  const highlightedIds = highlight?.ids ?? null;

  const handleSelect = useCallback((id: ArchComponentId) => {
    setFocusedId((current) => (current === id ? null : id));
  }, []);

  const focusedComponent = focusedId ? getComponent(focusedId) : null;
  const hubPosition = layout[HUB_ID].position;
  const aiPosition = layout["ai-layer"].position;

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={tier === "desktop" ? [1, 1.75] : tier === "tablet" ? [1, 1.4] : [1, 1]}
        gl={{ antialias: true }}
        camera={{ position: INTRO_START_POSITION.toArray(), fov: 50, near: 0.1, far: 200 }}
        onPointerMissed={() => setFocusedId(null)}
      >
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <fog attach="fog" args={[SCENE_BACKGROUND, 24, 74]} />

        <ambientLight intensity={0.55} />
        <directionalLight position={[12, 16, 10]} intensity={1.15} color="#bcd7ff" />
        <pointLight position={[-16, -6, 8]} intensity={0.4} color="#22d3ee" />
        <pointLight position={[0, 4, -10]} intensity={0.25} color="#7db4f2" />

        {/* Must mount first so its useFrame (default priority, subscription order) runs before
            anything below reads a scanner's position or a dynamic edge's curve this frame. */}
        <OrbitDriver layout={layout} edges={edges} />

        <ArchitectureBackground3D tier={tier} />

        {tier !== "mobile" && (
          <>
            <VolumetricLightCone position={hubPosition} color="#5b8def" height={10} radius={2.6} />
            <VolumetricLightCone position={aiPosition} color="#c084fc" height={7} radius={1.8} />
          </>
        )}

        {edges.map((edge) => {
          const onPath = Boolean(highlightedIds?.has(edge.from) && highlightedIds?.has(edge.to));
          return (
            <ConnectionPath3D
              key={edge.id}
              curve={edge.curve}
              isHighlighted={onPath}
              isDimmed={highlightedIds !== null && !onPath}
              isDynamic={edge.isDynamic}
            />
          );
        })}

        <DataPackets3D edges={edges} activeId={activeId} highlightedIds={highlightedIds} colorFor={colorForEdge} />

        {ARCH_COMPONENTS.map((component) => {
          const onPath = highlightedIds ? highlightedIds.has(component.id) : true;
          return (
            <ArchitectureNode3D
              key={component.id}
              component={component}
              position={layout[component.id].position}
              phase={layout[component.id].phase}
              isHub={component.id === HUB_ID}
              isActive={hoveredId === component.id || focusedId === component.id}
              isHovered={hoveredId === component.id}
              isDimmed={highlightedIds !== null && !onPath}
              onHoverChange={setHoveredId}
              onSelect={handleSelect}
            />
          );
        })}

        <CameraRig
          restPosition={REST_POSITION}
          restTarget={REST_TARGET}
          introStartPosition={INTRO_START_POSITION}
          focusPosition={focusedId ? layout[focusedId].position : null}
          focusKey={focusedId}
          resetSignal={resetSignal}
        />

        <SceneEffects tier={tier} />
      </Canvas>

      {/* The only other camera-movement trigger besides clicking a node (see CameraRig's
          docstring) — deliberately a plain DOM button outside the Canvas, not a 3D-anchored
          drei <Html>, since this is a fixed screen-space corner control, not something that
          should track world position. */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setResetSignal((n) => n + 1)}
        className="absolute right-3 top-3 shadow-md"
      >
        <RotateCcw className="size-3.5" />
        Reset View
      </Button>

      <NodeSidePanel component={focusedComponent} onClose={() => setFocusedId(null)} />
    </div>
  );
}
