import type { Severity } from "../types/api";

// Fixed status palette (see dataviz skill's references/palette.md) — never
// themed, never reused for chart series identity. INFO isn't a risk state
// so it gets neutral muted ink rather than a status color.
export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

// `ScanJobStatusResponse.summary` is a heterogeneous object — the five
// severity counts sit alongside `by_category`/`by_source`/`scanner_status`/
// `aggregation`, which are dicts/strings, not numbers. Iterating it with
// `Object.entries` and summing values would add a nested object to a
// number for those keys. This picks out only the known severity keys.
export function extractSeverityCounts(
  summary: Record<string, unknown> | null | undefined,
): Partial<Record<Severity, number>> {
  const counts: Partial<Record<Severity, number>> = {};
  if (!summary) return counts;
  for (const severity of SEVERITY_ORDER) {
    const value = summary[severity];
    if (typeof value === "number") counts[severity] = value;
  }
  return counts;
}

interface SeverityStyle {
  label: string;
  text: string;
  bg: string;
  ring: string;
  dot: string;
  hex: string;
}

export const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  CRITICAL: {
    label: "Critical",
    text: "text-[#d03b3b] dark:text-[#e66767]",
    bg: "bg-[#d03b3b]/10 dark:bg-[#e66767]/15",
    ring: "ring-[#d03b3b]/25 dark:ring-[#e66767]/30",
    dot: "bg-[#d03b3b] dark:bg-[#e66767]",
    hex: "#d03b3b",
  },
  HIGH: {
    label: "High",
    text: "text-[#c1592f] dark:text-[#ec835a]",
    bg: "bg-[#ec835a]/10 dark:bg-[#ec835a]/15",
    ring: "ring-[#ec835a]/25 dark:ring-[#ec835a]/30",
    dot: "bg-[#ec835a]",
    hex: "#ec835a",
  },
  MEDIUM: {
    label: "Medium",
    text: "text-[#946a00] dark:text-[#fab219]",
    bg: "bg-[#fab219]/15 dark:bg-[#fab219]/15",
    ring: "ring-[#fab219]/30 dark:ring-[#fab219]/30",
    dot: "bg-[#fab219]",
    hex: "#fab219",
  },
  LOW: {
    label: "Low",
    text: "text-[#0ca30c] dark:text-[#0ca30c]",
    bg: "bg-[#0ca30c]/10 dark:bg-[#0ca30c]/15",
    ring: "ring-[#0ca30c]/25 dark:ring-[#0ca30c]/30",
    dot: "bg-[#0ca30c]",
    hex: "#0ca30c",
  },
  INFO: {
    label: "Info",
    text: "text-muted-foreground",
    bg: "bg-muted",
    ring: "ring-border",
    dot: "bg-muted-foreground",
    hex: "#898781",
  },
};

export function severityStyle(severity: string): SeverityStyle {
  return SEVERITY_STYLES[severity as Severity] ?? SEVERITY_STYLES.INFO;
}

// Fixed categorical palette (dataviz skill) — assigned in this order,
// never cycled or reassigned when a filter changes the series count.
export const CATEGORICAL_PALETTE = [
  { name: "blue", light: "#2a78d6", dark: "#3987e5" },
  { name: "green", light: "#008300", dark: "#008300" },
  { name: "magenta", light: "#e87ba4", dark: "#d55181" },
  { name: "yellow", light: "#eda100", dark: "#c98500" },
  { name: "aqua", light: "#1baf7a", dark: "#199e70" },
  { name: "orange", light: "#eb6834", dark: "#d95926" },
  { name: "violet", light: "#4a3aa7", dark: "#9085e9" },
  { name: "red", light: "#e34948", dark: "#e66767" },
] as const;
