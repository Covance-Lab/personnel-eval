"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { EvaluationRecord } from "@/types/evaluation";

interface Props {
  evaluations: EvaluationRecord[];
}

export default function ScoreTrendChart({ evaluations }: Props) {
  const sorted = [...evaluations].sort((a, b) => {
    if (a.period.year !== b.period.year) return a.period.year - b.period.year;
    return a.period.month - b.period.month;
  });

  const data = sorted.map((ev) => ({
    period: `${ev.period.year}/${String(ev.period.month).padStart(2, "0")}`,
    本人評価: ev.overallSelfScore ?? null,
    AM評価: ev.overallAmScore ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: "#6b7280" }}
        />
        <YAxis
          domain={[0, 5]}
          tickCount={6}
          tick={{ fontSize: 11, fill: "#6b7280" }}
        />
        <Tooltip
          formatter={(value) => [`${value} / 5`]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="本人評価"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="AM評価"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
