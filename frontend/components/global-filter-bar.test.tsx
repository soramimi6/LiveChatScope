import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalFilterBar } from "@/components/global-filter-bar";
import type { DisplayFilter } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  postAnalysisRefilter: vi.fn().mockResolvedValue({
    video_id: "test",
    analysis_status: "running",
    status_url: "/status",
  }),
  getVideoStatus: vi.fn().mockResolvedValue({
    analysis_status: "complete",
  }),
}));

const DEFAULT_FILTER: DisplayFilter = {
  exclude_stamp_only: false,
  exclude_ng_keywords: false,
  ng_keywords: [],
  auto_ng_keywords: [],
  dismissed_auto_ng_keywords: [],
  excluded_author_ids: [],
};

describe("GlobalFilterBar", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("starts collapsed and expands on header click", () => {
    render(
      <GlobalFilterBar
        videoId="test"
        initialFilter={DEFAULT_FILTER}
        analysisStatus="complete"
        onRefilterComplete={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("NG キーワード")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /表示フィルター/i }));

    expect(screen.getByLabelText("NG キーワード")).toBeInTheDocument();
  });

  it("shows auto NG keywords with 自動追加 label", () => {
    render(
      <GlobalFilterBar
        videoId="test-auto-ng"
        initialFilter={{
          ...DEFAULT_FILTER,
          auto_ng_keywords: ["配信者名", "草"],
        }}
        analysisStatus="complete"
        onRefilterComplete={vi.fn()}
      />,
    );

    const section = screen.getByRole("region", { name: "表示フィルター" });
    fireEvent.click(
      within(section).getByRole("button", { name: /表示フィルター/i }),
    );

    expect(within(section).getByText("配信者名")).toBeInTheDocument();
    expect(within(section).getByText("草")).toBeInTheDocument();
    expect(within(section).getAllByText("自動追加")).toHaveLength(2);
  });

  it("removes auto NG keyword on dismiss click", async () => {
    const { postAnalysisRefilter } = await import("@/lib/api");
    render(
      <GlobalFilterBar
        videoId="test-auto-ng-remove"
        initialFilter={{
          ...DEFAULT_FILTER,
          auto_ng_keywords: ["配信者名"],
        }}
        analysisStatus="complete"
        onRefilterComplete={vi.fn()}
      />,
    );

    const section = screen.getByRole("region", { name: "表示フィルター" });
    fireEvent.click(
      within(section).getByRole("button", { name: /表示フィルター/i }),
    );
    fireEvent.click(
      within(section).getByRole("button", {
        name: "配信者名 を自動 NG から解除",
      }),
    );

    expect(within(section).queryByText("配信者名")).not.toBeInTheDocument();
    expect(postAnalysisRefilter).toHaveBeenCalledWith(
      "test-auto-ng-remove",
      expect.objectContaining({
        auto_ng_keywords: [],
        dismissed_auto_ng_keywords: ["配信者名"],
      }),
    );
  });
});
