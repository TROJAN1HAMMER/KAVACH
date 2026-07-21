import type { HTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const shouldReduceMotion = useReducedMotion();
  // Badges here mostly reflect a status (scan queued -> running -> completed,
  // user active/inactive) that can change live under the same instance. For
  // the common case — plain text/number content — a `key`'d motion.span
  // makes that change read as a soft fade to the new state rather than an
  // instant swap, with no AnimatePresence/exit handling needed: the old
  // content is simply gone the instant React swaps keys, and the new
  // content fades in over the (unanimated) pill background. Composite
  // children (icon + text, etc.) don't have a stable primitive identity to
  // key on, so they're rendered plainly rather than guessing one.
  const isPrimitive = typeof children === "string" || typeof children === "number";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {isPrimitive ? (
        <motion.span
          key={`${tone}-${children}`}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {children}
        </motion.span>
      ) : (
        children
      )}
    </span>
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
