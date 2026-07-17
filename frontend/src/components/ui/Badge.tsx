import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { severityStyle } from "../../lib/severity";
import type { Severity } from "../../types/api";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  primary: "bg-accent text-accent-foreground ring-primary/20",
  success: "bg-success/10 text-success ring-success/25",
  warning: "bg-warning/15 text-[#946a00] dark:text-warning ring-warning/30",
  danger: "bg-danger/10 text-danger ring-danger/25",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity | string; className?: string }) {
  const style = severityStyle(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        style.bg,
        style.text,
        style.ring,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}
