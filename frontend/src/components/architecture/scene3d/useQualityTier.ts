import { useEffect, useState } from "react";

export type QualityTier = "mobile" | "tablet" | "desktop";

/** Matches this app's existing Tailwind breakpoints (`sm`=640, `lg`=1024) rather than
 *  inventing new ones, so "mobile"/"tablet"/"desktop" here line up with what those words mean
 *  everywhere else in the app. */
function tierForWidth(width: number): QualityTier {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

/**
 * Drives how much visual fidelity the 3D scene spends: bloom/postprocessing, particle counts,
 * and device pixel ratio all scale down a tier at a time. Interactions (orbit/zoom/pan/hover/
 * click) are never gated by this — only rendering cost is.
 */
export function useQualityTier(): QualityTier {
  const [tier, setTier] = useState<QualityTier>(() =>
    typeof window === "undefined" ? "desktop" : tierForWidth(window.innerWidth),
  );

  useEffect(() => {
    const handleResize = () => setTier(tierForWidth(window.innerWidth));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return tier;
}
