/** Minimum Y value for log-scale density charts (log(0) is undefined). */
export const DENSITY_LOG_FLOOR = 0.1;

/** Minimum Y value for log-scale super chat amount (JPY). */
export const SUPER_CHAT_AMOUNT_LOG_FLOOR = 1;

/** Exponent for emphasis (power) scale — high values spread toward the top. */
export const DENSITY_EMPHASIS_POWER = 2;

export type DensityYScale = "linear" | "log" | "emphasis";

/** Cookie scope per chart so preferences stay independent. */
export type YScaleChartId =
  | "highlights-density"
  | "revenue-density"
  | "revenue-superchat";

const COOKIE_BY_CHART: Record<YScaleChartId, string> = {
  "highlights-density": "livechatscope_density_y_scale",
  "revenue-density": "livechatscope_revenue_density_y_scale",
  "revenue-superchat": "livechatscope_revenue_sc_y_scale",
};

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

const VALID_Y_SCALES = new Set<DensityYScale>(["linear", "log", "emphasis"]);

export function valueForLogScale(value: number, floor: number): number {
  return Math.max(value, floor);
}

export function valueForEmphasisScale(
  value: number,
  power = DENSITY_EMPHASIS_POWER,
): number {
  return Math.pow(Math.max(value, 0), power);
}

export function inverseEmphasisScale(
  transformed: number,
  power = DENSITY_EMPHASIS_POWER,
): number {
  return Math.pow(Math.max(transformed, 0), 1 / power);
}

export function densityRateForLogScale(ratePerMin: number): number {
  return valueForLogScale(ratePerMin, DENSITY_LOG_FLOOR);
}

export function densityRateForEmphasisScale(ratePerMin: number): number {
  return valueForEmphasisScale(ratePerMin);
}

export function superChatAmountForLogScale(amountJpy: number): number {
  return valueForLogScale(amountJpy, SUPER_CHAT_AMOUNT_LOG_FLOOR);
}

export function superChatAmountForEmphasisScale(amountJpy: number): number {
  return valueForEmphasisScale(amountJpy);
}

export function readYScale(chartId: YScaleChartId): DensityYScale {
  if (typeof document === "undefined") {
    return "linear";
  }
  const cookieName = COOKIE_BY_CHART[chartId];
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${cookieName}=([^;]*)`),
  );
  const raw = match?.[1];
  return raw && VALID_Y_SCALES.has(raw as DensityYScale)
    ? (raw as DensityYScale)
    : "linear";
}

export function writeYScale(chartId: YScaleChartId, scale: DensityYScale): void {
  if (typeof document === "undefined") {
    return;
  }
  const cookieName = COOKIE_BY_CHART[chartId];
  document.cookie = `${cookieName}=${scale}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

/** @deprecated Use readYScale("highlights-density") */
export function readDensityYScale(): DensityYScale {
  return readYScale("highlights-density");
}

/** @deprecated Use writeYScale("highlights-density", scale) */
export function writeDensityYScale(scale: DensityYScale): void {
  writeYScale("highlights-density", scale);
}

export function densityYScaleLabel(scale: DensityYScale): string {
  if (scale === "log") return "対数";
  if (scale === "emphasis") return "強調";
  return "線形";
}

export function rechartsYAxisScale(scale: DensityYScale): "linear" | "log" {
  return scale === "log" ? "log" : "linear";
}

export function yAxisDomain(
  scale: DensityYScale,
  logFloor: number,
): [number | string, string] {
  return scale === "log" ? [logFloor, "auto"] : [0, "auto"];
}

export function yScaleSeriesKey<T extends string>(
  scale: DensityYScale,
  keys: { linear: T; log: T; emphasis: T },
): T {
  if (scale === "log") return keys.log;
  if (scale === "emphasis") return keys.emphasis;
  return keys.linear;
}

export function yScaleCookieName(chartId: YScaleChartId): string {
  return COOKIE_BY_CHART[chartId];
}

export function formatYAxisTick(value: number): string {
  return value >= 10
    ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Y-axis tick labels: emphasis mode shows original values, not transformed. */
export function formatYAxisTickForScale(
  value: number,
  scale: DensityYScale,
): string {
  if (scale === "emphasis") {
    return formatYAxisTick(inverseEmphasisScale(value));
  }
  return formatYAxisTick(value);
}
