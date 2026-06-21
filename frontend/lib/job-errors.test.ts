import { describe, expect, it } from "vitest";
import { canRetryJob, formatJobError } from "@/lib/job-errors";

describe("job-errors", () => {
  it("maps INTERRUPTED to a retry hint", () => {
    const message = formatJobError({ code: "INTERRUPTED", message: "raw" });
    expect(message).toContain("再試行");
  });

  it("allows retry for failed fetch or analysis", () => {
    expect(
      canRetryJob({
        fetch_status: "failed",
        analysis_status: "pending",
        error: { code: "INTERRUPTED", message: "" },
      }),
    ).toBe(true);
    expect(
      canRetryJob({
        fetch_status: "fetched",
        analysis_status: "failed",
        error: { code: "ANALYSIS_FAILED", message: "" },
      }),
    ).toBe(true);
  });

  it("disables retry for replay disabled and missing video", () => {
    expect(
      canRetryJob({
        fetch_status: "failed",
        analysis_status: "pending",
        error: { code: "REPLAY_DISABLED", message: "" },
      }),
    ).toBe(false);
  });
});
