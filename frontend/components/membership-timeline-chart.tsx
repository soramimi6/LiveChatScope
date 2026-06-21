"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MembershipEventsResponse } from "@/lib/api/community";
import { formatSeconds } from "@/lib/format";

type MembershipTimelineChartProps = {
  data: MembershipEventsResponse;
  durationSeconds?: number | null;
};

type EventPoint = {
  time_in_seconds: number;
  y: number;
  author_name: string;
  time_text: string;
  jump_url: string | null;
};

function EventStem({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: EventPoint;
}) {
  if (cx == null || cy == null) return null;
  const stemHeight = 48;
  return (
    <line
      x1={cx}
      y1={cy + stemHeight / 2}
      x2={cx}
      y2={cy - stemHeight / 2}
      stroke="hsl(var(--primary))"
      strokeWidth={2}
      aria-label={payload ? `${payload.author_name} ${payload.time_text}` : undefined}
    />
  );
}

export function MembershipTimelineChart({
  data,
  durationSeconds,
}: MembershipTimelineChartProps) {
  const timedEvents = useMemo(
    () =>
      data.registrations.filter(
        (item): item is typeof item & { time_in_seconds: number; time_text: string } =>
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

  const chartPoints = useMemo<EventPoint[]>(
    () =>
      timedEvents.map((item) => ({
        time_in_seconds: item.time_in_seconds,
        y: 0.5,
        author_name: item.author_name,
        time_text: item.time_text,
        jump_url: item.jump_url,
      })),
    [timedEvents],
  );

  if (chartPoints.length === 0) {
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
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              type="number"
              dataKey="time_in_seconds"
              domain={[0, maxTime]}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) => formatSeconds(value)}
              minTickGap={32}
              name="時刻"
            />
            <YAxis type="number" domain={[0, 1]} hide />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as EventPoint;
                return (
                  <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                    <p className="font-medium">{point.author_name}</p>
                    <p className="tabular-nums text-muted-foreground">{point.time_text}</p>
                  </div>
                );
              }}
            />
            <Scatter
              data={chartPoints}
              dataKey="time_in_seconds"
              fill="hsl(var(--primary))"
              shape={<EventStem />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        各登録の発生時刻を細い棒で表示しています（{chartPoints.length} 件）。
        {unknownCount > 0 ? ` 時刻不明: ${unknownCount} 人。` : null}
      </p>
    </div>
  );
}
