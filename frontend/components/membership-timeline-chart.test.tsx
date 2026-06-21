import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MembershipTimelineChart } from "@/components/membership-timeline-chart";
import type { MembershipEventsResponse } from "@/lib/api/community";

const SAMPLE_EVENTS: MembershipEventsResponse = {
  video_id: "test",
  total_unique: 2,
  timeline: [{ bucket_start_sec: 120, count: 1 }],
  bursts: [],
  registrations: [
    {
      author_id: "UC-1",
      author_name: "member1",
      time_in_seconds: 120,
      time_text: "00:02:00",
      time_unknown: false,
      jump_url: "https://example.com",
      registered_during_stream: true,
    },
    {
      author_id: "UC-2",
      author_name: "member2",
      time_in_seconds: 600,
      time_text: "00:10:00",
      time_unknown: false,
      jump_url: "https://example.com",
      registered_during_stream: true,
    },
  ],
};

describe("MembershipTimelineChart", () => {
  it("renders event stems for timed registrations", () => {
    const { container } = render(
      <MembershipTimelineChart data={SAMPLE_EVENTS} durationSeconds={3600} />,
    );

    expect(screen.getByRole("img", { name: "メンバー登録タイムライン" })).toBeInTheDocument();
    expect(container.querySelectorAll("line.stroke-primary")).toHaveLength(2);
    expect(container.querySelectorAll("circle.fill-primary")).toHaveLength(2);
    expect(screen.getByText(/2 件/)).toBeInTheDocument();
  });
});
