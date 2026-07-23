import type { ReactNode } from "react";
import type { ArchComponentId } from "../../componentData";
import type { NodeGeometryProps } from "./types";
import { GlowSphere } from "./GlowSphere";
import { NodeCylinder } from "./NodeCylinder";
import { FuturisticCube } from "./FuturisticCube";
import { Shield } from "./Shield";
import { Octahedron } from "./Octahedron";
import { StackedCylinders } from "./StackedCylinders";
import { HexPrism } from "./HexPrism";
import { Dodecahedron } from "./Dodecahedron";
import { Crystal } from "./Crystal";
import { RotatingIcosahedron } from "./RotatingIcosahedron";
import { DocumentPlane } from "./DocumentPlane";
import { HologramScreen } from "./HologramScreen";
import { Beacon } from "./Beacon";

export type { NodeGeometryProps } from "./types";

/**
 * One real 3D shape per node type — replaces the single `RoundedBox` every
 * node used to render regardless of what it represented. A factory function
 * (not a bare component reference) so two ids that share a shape
 * (Authentication/Compliance's shield, Redis/Storage's stacked discs) can
 * pass different tuning params without a second component file.
 */
export const NODE_GEOMETRY: Record<ArchComponentId, (props: NodeGeometryProps) => ReactNode> = {
  "git-provider": (props) => <GlowSphere {...props} />,
  webhook: (props) => <NodeCylinder {...props} />,
  "api-gateway": (props) => <FuturisticCube {...props} />,
  authentication: (props) => <Shield {...props} />,
  "scan-orchestrator": (props) => <Octahedron {...props} />,
  "redis-queue": (props) => <StackedCylinders {...props} layers={3} radiusScale={0.42} gapScale={0.24} />,
  // Same hex-prism silhouette as the hub, just smaller — `ArchitectureNode3D` already renders
  // non-hub nodes at a smaller `baseSize`, so "large hub / smaller floating modules" falls out
  // of that existing size differentiation with no extra params needed here.
  "celery-workers": (props) => <HexPrism {...props} />,
  semgrep: (props) => <HexPrism {...props} />,
  "ast-grep": (props) => <HexPrism {...props} />,
  joern: (props) => <HexPrism {...props} />,
  "dependency-analysis": (props) => <HexPrism {...props} />,
  "secrets-detection": (props) => <HexPrism {...props} />,
  "configuration-scanner": (props) => <HexPrism {...props} />,
  "aggregation-layer": (props) => <Dodecahedron {...props} />,
  "brs-engine": (props) => <Crystal {...props} />,
  "compliance-engine": (props) => <Shield {...props} aspect={1.15} />,
  "ai-layer": (props) => <RotatingIcosahedron {...props} />,
  "report-generator": (props) => <DocumentPlane {...props} />,
  dashboard: (props) => <HologramScreen {...props} />,
  storage: (props) => <StackedCylinders {...props} layers={4} radiusScale={0.55} gapScale={0.16} />,
  notifications: (props) => <Beacon {...props} />,
};
