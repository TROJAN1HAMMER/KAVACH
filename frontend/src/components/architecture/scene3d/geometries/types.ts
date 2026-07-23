/**
 * Common contract every per-node-type geometry component implements. Deliberately just
 * visual/geometric inputs — material discovery for the hover/dim easing happens by the parent
 * `ArchitectureNode3D` traversing its own mounted group after render (see its docstring),
 * rather than these components reporting materials back up via a callback, which ran into
 * React's "no ref access during render" rule (passing a ref-closing callback into a function
 * invoked during render, even though the ref itself is only ever dereferenced later, isn't
 * something the linter can prove safe).
 */
export interface NodeGeometryProps {
  size: number;
  color: string;
  glowColor: string;
}
