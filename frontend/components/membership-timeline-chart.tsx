"use client";

import { useMemo, useState } from "react";
import type {
  MembershipEventsResponse,
  MembershipRegistrationItem,
} from "@/lib/api/community";
import { formatSeconds } from "@/lib/format";

type MembershipTimelineChartProps = {
  data: MembershipEventsResponse;
  durationSeconds?: number | null;
};

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 140;
const PLOT_LEFT = 56;
const PLOT_RIGHT = 16;
const PLOT_TOP = 16;
const BASELINE_Y = 108;
const STEM_TOP = 28;

type TimedRegistration = MembershipRegistrationItem & {
  time_in_seconds: number;
  time_text: string;
};

export function MembershipTimelineChart({
  data,
  durationSeconds,
}: MembershipTimelineChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const timedEvents = useMemo(
    () =>
      data.registrations.filter(
        (item): item is TimedRegistration =>
          item.time_in_seconds != null && item.time_text != null,
      ),
    [data.registrations],
  );

  const unknownCount = data.registrations.filter((item) => item.time_unknown).length;

  const maxTime = useMemo(() => {
    if (durationSeconds != null && durationSeconds > 0) {
      return durationSeconds;
    }
    const latest = timedEvents.reduce(
      (max, item) => Math.max(max, item.time_in_seconds),
      0,
    );
    return latest > 0 ? latest : 3600;
  }, [durationSeconds, timedEvents]);

  const plotWidth = VIEW_WIDTH - PLOT_LEFT - PLOT_RIGHT;

  const positionedEvents = useMemo(
    () =>
      timedEvents.map((event) => ({
        ...event,
        x: PLOT_LEFT + (event.time_in_seconds / maxTime) * plotWidth,
      })),
    [timedEvents, maxTime, plotWidth],
  );

  const axisTicks = useMemo(() => {
    const tickCount = 5;
    return Array.from({ length: tickCount }, (_, index) => {
      const ratio = index / (tickCount - 1);
      const seconds = Math.round(maxTime * ratio);
      return {
        seconds,
        x: PLOT_LEFT + ratio * plotWidth,
        label: formatSeconds(seconds),
      };
    });
  }, [maxTime, plotWidth]);

  const hoveredEvent =
    positionedEvents.find((event) => event.author_id === hoveredId) ?? null;

  if (positionedEvents.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          メンバーシップ登録のタイムラインデータがありません。
        </p>
        {unknownCount > 0 ? (
          <p className="text-xs text-muted-foreground">時刻不明: {unknownCount} 人</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative h-36 w-full">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="h-full w-full"
          role="img"
          aria-label="メンバー登録タイムライン"
        >
          <line
            x1={PLOT_LEFT}
            y1={BASELINE_Y}
            x2={VIEW_WIDTH - PLOT_RIGHT}
            y2={BASELINE_Y}
            className="stroke-border"
            strokeWidth={1}
          />
          {axisTicks.map((tick) => (
            <g key={tick.seconds}>
              <line
                x1={tick.x}
                y1={BASELINE_Y}
                x2={tick.x}
                y2={BASELINE_Y + 4}
                className="stroke-muted-foreground"
                strokeWidth={1}
              />
              <text
                x={tick.x}
                y={VIEW_HEIGHT - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {tick.label}
              </text>
            </g>
          ))}
          {positionedEvents.map((event) => (
            <g
              key={event.author_id}
              onMouseEnter={() => setHoveredId(event.author_id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(event.author_id)}
              onBlur={() => setHoveredId(null)}
            >
              <line
                x1={event.x}
                y1={BASELINE_Y}
                x2={event.x}
                y2={STEM_TOP}
                className="stroke-primary"
                strokeWidth={hoveredId === event.author_id ? 3 : 2}
                strokeLinecap="round"
              />
              <circle
                cx={event.x}
                cy={STEM_TOP}
                r={hoveredId === event.author_id ? 4 : 3}
                className="fill-primary"
              />
              <title>
                {event.author_name} — {event.time_text}
              </title>
            </g>
          ))}
        </svg>
        {hoveredEvent ? (
          <div
            className="pointer-events-none absolute top-0 rounded-md border bg-background px-2 py-1 text-xs shadow-sm"
            style={{
              left: `${(hoveredEvent.x / VIEW_WIDTH) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-medium">{hoveredEvent.author_name}</p>
            <p className="tabular-nums text-muted-foreground">{hoveredEvent.time_text}</p>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        各登録の発生時刻を細い棒で表示しています（{positionedEvents.length} 件）。
        {unknownCount > 0 ? ` 時刻不明: ${unknownCount} 人。` : null}
      </p>
    </div>
  );
}
