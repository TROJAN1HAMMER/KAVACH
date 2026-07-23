import { useId } from "react";
import type { Severity } from "../types/api";

export interface ChartGradientIds {
  blue: string;
  severity: (severity: Severity) => string;
  categorical: (index: number) => string;
}

/** Every gradient-consuming chart mounts its own `<defs>`, so ids are
 *  namespaced per chart instance (via `useId`) — safe even when the same
 *  chart component renders more than once on a page. */
export function useChartGradientIds(): ChartGradientIds {
  const raw = useId().replace(/[:]/g, "");
  return {
    blue: `${raw}-blue`,
    severity: (severity) => `${raw}-sev-${severity}`,
    categorical: (index) => `${raw}-cat-${index}`,
  };
}
