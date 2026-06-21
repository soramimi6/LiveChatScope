"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MembershipEventsResponse } from "@/lib/api/community";
import { formatSeconds } from "@/lib/format";

type MembershipTimelineChartProps = {
  data: MembershipEventsResponse;
};

export function MembershipTimelineChart({ data }: MembershipTimelineChartProps) {
  const chartData = useMemo(
    () =>
      data.timeline.map((bucket) => ({
        label: formatSeconds(bucket.bucket_start_sec),
        count: bucket.count,
        bucket_start_sec: bucket.bucket_start_sec,
      })),
    [data.timeline],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        メンバーシップ登録のタイムラインデータがありません。
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
          <Tooltip
            formatter={(value: number) => [`${value} 人`, "ユニーク登録"]}
            labelFormatter={(label) => `開始 ${label}`}
          />
          <Bar dataKey="count" name="ユニーク登録" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
