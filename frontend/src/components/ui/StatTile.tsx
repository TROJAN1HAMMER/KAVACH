import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card } from "./Card";

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: {
    value: number;
    label: string;
    isGoodWhenUp?: boolean;
  };
  className?: string;
}

export function StatTile({ label, value, icon, delta, className }: StatTileProps) {
  let deltaColor = "text-muted-foreground";
  if (delta) {
    const goodWhenUp = delta.isGoodWhenUp ?? true;
    const isUp = delta.value >= 0;
    const isGood = isUp === goodWhenUp;
    deltaColor = isGood ? "text-success" : "text-danger";
  }

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {delta && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", deltaColor)}>
          {delta.value >= 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
          {Math.abs(delta.value)}% {delta.label}
        </p>
      )}
    </Card>
  );
}
