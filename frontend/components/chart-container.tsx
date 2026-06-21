"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

type ChartContainerProps = {
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
  children: ReactElement;
};

/** Renders Recharts only after the container has measurable size (avoids hidden-tab warnings). */
export function ChartContainer({
  className,
  children,
  ...rest
}: ChartContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setReady(width > 0 && height > 0);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("min-h-0 min-w-0", className)} {...rest}>
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
