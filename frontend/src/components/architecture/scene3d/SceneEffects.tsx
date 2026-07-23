import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { QualityTier } from "./useQualityTier";

interface SceneEffectsProps {
  tier: QualityTier;
}

/**
 * Bloom is the single biggest contributor to the "premium" feel the brief asks for (every
 * emissive material — node bodies, halos, connection lines, packets — blooms softly instead of
 * looking like flat unlit color), but it's also the most expensive thing in this scene. Fully
 * off on mobile, a cheaper single-pass version on tablet, the mipmap-blurred version on desktop
 * — interactions are unaffected at every tier, only this visual layer scales down.
 *
 * `multisampling` deliberately stays at 0 regardless of tier: requesting MSAA render targets
 * through `EffectComposer` produced a blank canvas in this project's headless Playwright/software-
 * rendering test environment (no thrown error, no console warning — it just silently failed to
 * composite), which is exactly the kind of GPU/driver-dependent failure mode that could also bite
 * real users on less common hardware. The `<Canvas>` itself already requests `antialias: true`
 * on its primary context, so turning this specific knob off costs very little.
 */
export function SceneEffects({ tier }: SceneEffectsProps) {
  if (tier === "mobile") return null;

  const isDesktop = tier === "desktop";

  return (
    <EffectComposer enabled multisampling={0}>
      <Bloom
        mipmapBlur={isDesktop}
        luminanceThreshold={isDesktop ? 0.12 : 0.22}
        luminanceSmoothing={0.9}
        intensity={isDesktop ? 1.1 : 0.7}
        radius={0.75}
      />
    </EffectComposer>
  );
}
