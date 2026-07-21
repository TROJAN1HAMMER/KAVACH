import type { ArchCategory } from "../componentData";

/**
 * Hex equivalents of the Tailwind color families `CATEGORY_META` already uses
 * (slate/sky/amber/indigo/orange/purple/emerald/teal) — three.js materials need real color
 * values, not CSS custom properties, so this translates the existing palette rather than
 * inventing a new one. `base` mirrors each category's `dot` (500-shade); `glow` mirrows the
 * lighter 400-shade used for dark-mode text/emissive accents.
 */
export const CATEGORY_COLORS: Record<ArchCategory, { base: string; glow: string }> = {
  source: { base: "#64748b", glow: "#94a3b8" },
  gateway: { base: "#0ea5e9", glow: "#38bdf8" },
  queue: { base: "#f59e0b", glow: "#fbbf24" },
  compute: { base: "#6366f1", glow: "#818cf8" },
  scanner: { base: "#f97316", glow: "#fb923c" },
  intelligence: { base: "#a855f7", glow: "#c084fc" },
  output: { base: "#10b981", glow: "#34d399" },
  storage: { base: "#14b8a6", glow: "#2dd4bf" },
};

/** Consistent with this app's `--color-primary` / accent tokens (see index.css) — same
 *  convention `HeroShield3D.tsx` uses for its hex constants. Connections render in this
 *  neutral "energy conduit" blue rather than each node's own category color, which keeps 21
 *  differently-colored nodes from turning the connection mesh into visual noise. */
export const LINE_COLOR = "#3987e5";
export const LINE_COLOR_HIGHLIGHT = "#8ec2ff";
export const SCENE_BACKGROUND = "#05070d";
