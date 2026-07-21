import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { PipelineDiagram } from "./PipelineDiagram";
import { ComponentDetailPanel } from "./ComponentDetailPanel";
import type { ArchComponentId } from "./componentData";

// The only place `three` / `@react-three/fiber` / `@react-three/drei` are imported for the
// architecture page — a React.lazy() dynamic import puts ArchitectureScene3D and its
// dependencies in their own chunk, fetched only once this section actually mounts. No other
// route imports this module, so none of it ever reaches those bundles.
const ArchitectureScene3D = lazy(() =>
  import("./scene3d/ArchitectureScene3D").then((mod) => ({ default: mod.ArchitectureScene3D })),
);

interface BoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

/** Swaps in the 2D pipeline diagram if the 3D scene throws (e.g. no WebGL support). */
class ArchitectureScene3DErrorBoundary extends Component<BoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ArchitectureScene3D failed to render; falling back to the 2D pipeline diagram.", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * The existing, fully-functional 2D flowchart + detail panel — used as: the render under
 * `prefers-reduced-motion`, the render while the 3D chunk streams in (Suspense fallback), and
 * the permanent fallback if the 3D scene throws (error boundary). This is what guarantees
 * "preserve existing functionality" — anyone who can't or doesn't want the 3D experience still
 * gets the exact same 2D experience that shipped before this page was upgraded.
 */
function Fallback2D() {
  const [selectedId, setSelectedId] = useState<ArchComponentId | null>(null);
  return (
    <>
      <PipelineDiagram selectedId={selectedId} onSelect={setSelectedId} />
      <ComponentDetailPanel componentId={selectedId} onClose={() => setSelectedId(null)} onNavigate={setSelectedId} />
    </>
  );
}

/**
 * Gates the interactive 3D architecture explorer behind the same three conditions
 * `HeroShield3DSection.tsx` uses for the landing-page hero: `prefers-reduced-motion`, a
 * render-error boundary, and `React.lazy` + `Suspense` for code-splitting. Unlike the hero
 * (a small decorative glyph fallback), the fallback here is the full 2D pipeline diagram, since
 * this page's entire job is exposing every architecture node's data and interactions.
 */
export function ArchitectureSceneSection() {
  const shouldReduceMotion = useReducedMotion();
  const fallback = <Fallback2D />;

  if (shouldReduceMotion) return fallback;

  return (
    <ArchitectureScene3DErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <div className="h-[620px] w-full overflow-hidden rounded-xl border border-border">
          <ArchitectureScene3D />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Drag to orbit · scroll to zoom · hover a node for details · click to focus the camera on it
        </p>
      </Suspense>
    </ArchitectureScene3DErrorBoundary>
  );
}
