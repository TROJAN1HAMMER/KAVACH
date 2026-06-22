import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to merge Tailwind CSS classes efficiently
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a CVSS score to 1 decimal place
 */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "N/A";
  return score.toFixed(1);
}
