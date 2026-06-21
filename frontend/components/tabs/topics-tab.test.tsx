import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopicsTab } from "@/components/tabs/topics-tab";

vi.mock("@/lib/api", () => ({
  getTopicsTabDataWithFallback: vi.fn().mockResolvedValue({
    data: {
      topics: {
        items: [
          {
            block_id: "b0",
            block_index: 0,
            start_sec: 120,
            end_sec: 300,
            label: "Test block",
            label_note: "推定話題",
            message_count: 10,
            unique_authors: 5,
            super_chat_total: [],
            jump_url: "https://www.youtube.com/watch?v=abc&t=120",
          },
        ],
      },
      transitions: { items: [] },
      keywords: { overall: [] },
    },
    isMock: false,
  }),
  getKeywordBurstsWithFallback: vi.fn().mockResolvedValue({
    data: { items: [] },
    isMock: false,
  }),
}));

describe("TopicsTab", () => {
  it("links thumbnail to jump_url and hides jump column", async () => {
    render(<TopicsTab videoId="abc" durationSeconds={600} />);

    expect(await screen.findByRole("link", { name: /Test block のサムネイル/i })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abc&t=120",
    );
    expect(screen.queryByRole("columnheader", { name: "ジャンプ" })).not.toBeInTheDocument();
  });
});
