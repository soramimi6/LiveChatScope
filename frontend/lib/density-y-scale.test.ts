import { afterEach, describe, expect, it } from "vitest";
import {
  DENSITY_EMPHASIS_POWER,
  DENSITY_LOG_FLOOR,
  SUPER_CHAT_AMOUNT_LOG_FLOOR,
  densityRateForEmphasisScale,
  densityRateForLogScale,
  densityYScaleLabel,
  formatYAxisTickForScale,
  inverseEmphasisScale,
  readYScale,
  superChatAmountForLogScale,
  writeYScale,
  yScaleCookieName,
  yScaleSeriesKey,
} from "@/lib/density-y-scale";

describe("density-y-scale", () => {
  afterEach(() => {
    for (const chartId of [
      "highlights-density",
      "revenue-density",
      "revenue-superchat",
    ] as const) {
      document.cookie = `${yScaleCookieName(chartId)}=; path=/; max-age=0`;
    }
  });

  it("defaults to linear when cookie is absent", () => {
    expect(readYScale("highlights-density")).toBe("linear");
    expect(readYScale("revenue-density")).toBe("linear");
  });

  it("persists chart-specific cookies independently", () => {
    writeYScale("highlights-density", "log");
    writeYScale("revenue-density", "linear");
    writeYScale("revenue-superchat", "emphasis");

    expect(readYScale("highlights-density")).toBe("log");
    expect(readYScale("revenue-density")).toBe("linear");
    expect(readYScale("revenue-superchat")).toBe("emphasis");
    expect(document.cookie).toContain("livechatscope_density_y_scale=log");
    expect(document.cookie).toContain("livechatscope_revenue_sc_y_scale=emphasis");
    expect(document.cookie).not.toContain("livechatscope_revenue_density_y_scale=log");
  });

  it("floors log-scale chart values", () => {
    expect(densityRateForLogScale(0)).toBe(DENSITY_LOG_FLOOR);
    expect(superChatAmountForLogScale(0)).toBe(SUPER_CHAT_AMOUNT_LOG_FLOOR);
  });

  it("maps scale labels and series keys", () => {
    expect(densityYScaleLabel("emphasis")).toBe("強調");
    expect(
      yScaleSeriesKey("emphasis", {
        linear: "ratePerMin",
        log: "logRatePerMin",
        emphasis: "emphRatePerMin",
      }),
    ).toBe("emphRatePerMin");
  });

  it("applies power transform for emphasis scale", () => {
    expect(densityRateForEmphasisScale(5)).toBe(25);
    expect(inverseEmphasisScale(25)).toBe(5);
    expect(formatYAxisTickForScale(100, "emphasis")).toBe("10");
    expect(formatYAxisTickForScale(100, "linear")).toBe("100");
    expect(DENSITY_EMPHASIS_POWER).toBe(2);
  });
});
