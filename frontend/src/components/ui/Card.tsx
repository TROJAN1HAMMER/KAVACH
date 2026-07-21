import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Opt-in hover elevation (a small shadow + translateY lift) for cards
   * that are themselves clickable or link-like — e.g. a callout card that
   * navigates somewhere on click. Left off by default so purely
   * informational cards (stat tiles, chart containers, table wrappers)
   * don't shimmer on every hover for no reason.
   */
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        interactive && "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  title,
  description,
  action,
  ...props
}: HTMLAttributes<HTMLDivElement> & { title?: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 p-5 pb-0", className)} {...props}>
      <div>
        {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
