import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalFilterBar } from "@/components/global-filter-bar";
import type { DisplayFilter } from "@/lib/api";

const DEFAULT_FILTER: DisplayFilter = {
  exclude_stamp_only: false,
  exclude_ng_keywords: false,
  ng_keywords: [],
  excluded_author_ids: [],
};

describe("GlobalFilterBar", () => {
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
});
