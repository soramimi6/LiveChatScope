import { describe, expect, it } from "vitest";
import {
  commentsPerMinute,
  formatCommentsPerMinute,
  formatRatePerMin,
} from "@/lib/density-chart";

describe("density-chart", () => {
  it("converts bucket count to comments per minute", () => {
    expect(commentsPerMinute(120, 60)).toBe(120);
    expect(commentsPerMinute(60, 60)).toBe(60);
    expect(commentsPerMinute(30, 30)).toBe(60);
  });

  it("formats rate as comments per minute", () => {
    expect(formatRatePerMin(90)).toBe("90.0 件/分");
    expect(formatCommentsPerMinute(90, 60)).toBe("90.0 件/分");
  });
});
