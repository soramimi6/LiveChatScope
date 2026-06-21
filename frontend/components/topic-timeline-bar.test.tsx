import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayFilterActionsProvider } from "@/components/display-filter-actions-context";
import { TopicTimelineBar } from "@/components/topic-timeline-bar";
import type { TopicBlockPreview } from "@/lib/api";

const SAMPLE_BLOCKS: TopicBlockPreview[] = [
  {
    block_id: "b0",
    block_index: 0,
    start_sec: 0,
    end_sec: 300,
    label: "Opening / ゲーム実況",
    label_note: "推定話題",
    message_count: 120,
    unique_authors: 80,
    jump_url: "https://www.youtube.com/watch?v=test&t=0",
  },
  {
    block_id: "b1",
    block_index: 1,
    start_sec: 300,
    end_sec: 600,
    label: "ボス戦 / 雑談",
    label_note: "推定話題",
    message_count: 200,
    unique_authors: 110,
    jump_url: "https://www.youtube.com/watch?v=test&t=300",
  },
];

afterEach(() => {
  cleanup();
});

describe("TopicTimelineBar", () => {
  it("renders legend labels and timeline segments", () => {
    const { container } = render(
      <TopicTimelineBar blocks={SAMPLE_BLOCKS} durationSeconds={600} />,
    );

    expect(screen.getByText("構成タイムライン")).toBeInTheDocument();
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("ゲーム実況")).toBeInTheDocument();
    expect(screen.getByText("ボス戦")).toBeInTheDocument();
    expect(screen.getByText("雑談")).toBeInTheDocument();

    expect(container.querySelector('[data-testid="timeline-track"]')).not.toBeNull();
    const segments = container.querySelectorAll('[data-testid="timeline-segment"]');
    expect(segments.length).toBe(2);
  });

  it("supports NG keyword add from legend tokens", () => {
    const addNgKeyword = vi.fn();

    render(
      <DisplayFilterActionsProvider
        value={{
          addNgKeyword,
          ngKeywords: [],
          updating: false,
        }}
      >
        <TopicTimelineBar
          blocks={SAMPLE_BLOCKS}
          durationSeconds={600}
          interactiveLabels
        />
      </DisplayFilterActionsProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "ゲーム実況 をNGワードに追加して除外" }),
    );
    expect(addNgKeyword).toHaveBeenCalledWith("ゲーム実況");
  });

  it("shows empty state when no blocks", () => {
    render(<TopicTimelineBar blocks={[]} durationSeconds={600} />);
    expect(screen.getByText("話題ブロックデータがありません。")).toBeInTheDocument();
  });
});
