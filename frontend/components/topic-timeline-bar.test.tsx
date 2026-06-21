import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("TopicTimelineBar", () => {
  it("renders legend labels and timeline segments", () => {
    const { container } = render(
      <TopicTimelineBar blocks={SAMPLE_BLOCKS} durationSeconds={600} />,
    );

    expect(screen.getByText("構成タイムライン")).toBeInTheDocument();
    expect(screen.getByText("Opening / ゲーム実況")).toBeInTheDocument();
    expect(screen.getByText("ボス戦 / 雑談")).toBeInTheDocument();

    expect(container.querySelector('[data-testid="timeline-track"]')).not.toBeNull();
    const segments = container.querySelectorAll('[data-testid="timeline-segment"]');
    expect(segments.length).toBe(2);
  });

  it("shows empty state when no blocks", () => {
    render(<TopicTimelineBar blocks={[]} durationSeconds={600} />);
    expect(screen.getByText("話題ブロックデータがありません。")).toBeInTheDocument();
  });
});
