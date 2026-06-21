import { describe, expect, it } from "vitest";
import {
  formatAnalysisStatusLabel,
  formatFetchStatusLabel,
} from "@/lib/job-status";

describe("job-status labels", () => {
  it("formats fetch status in Japanese", () => {
    expect(formatFetchStatusLabel("fetched")).toBe("取得完了");
    expect(formatFetchStatusLabel("fetching")).toBe("取得中");
  });

  it("formats analysis status in Japanese", () => {
    expect(formatAnalysisStatusLabel("running")).toBe("分析中");
    expect(formatAnalysisStatusLabel("complete")).toBe("完了");
  });

  it("falls back for unknown values", () => {
    expect(formatFetchStatusLabel("custom")).toBe("custom");
    expect(formatAnalysisStatusLabel(undefined)).toBe("—");
  });
});
