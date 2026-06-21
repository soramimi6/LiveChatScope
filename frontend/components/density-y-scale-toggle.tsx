"use client";

import { cn } from "@/lib/utils";
import {
  densityYScaleLabel,
  type DensityYScale,
} from "@/lib/density-y-scale";

type DensityYScaleToggleProps = {
  value: DensityYScale;
  onChange: (scale: DensityYScale) => void;
  className?: string;
  ariaLabel?: string;
};

const OPTIONS: DensityYScale[] = ["linear", "log", "emphasis"];

export function DensityYScaleToggle({
  value,
  onChange,
  className,
  ariaLabel = "縦軸スケール",
}: DensityYScaleToggleProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
    >
      {OPTIONS.map((scale) => (
        <button
          key={scale}
          type="button"
          aria-pressed={value === scale}
          onClick={() => onChange(scale)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === scale
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {densityYScaleLabel(scale)}
        </button>
      ))}
    </div>
  );
}
