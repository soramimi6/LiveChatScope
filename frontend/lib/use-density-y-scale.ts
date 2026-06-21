"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readYScale,
  writeYScale,
  type DensityYScale,
  type YScaleChartId,
} from "@/lib/density-y-scale";

export function useDensityYScale(
  chartId: YScaleChartId,
): [DensityYScale, (scale: DensityYScale) => void] {
  const [yScale, setYScaleState] = useState<DensityYScale>("linear");

  useEffect(() => {
    setYScaleState(readYScale(chartId));
  }, [chartId]);

  const setYScale = useCallback(
    (scale: DensityYScale) => {
      setYScaleState(scale);
      writeYScale(chartId, scale);
    },
    [chartId],
  );

  return [yScale, setYScale];
}
