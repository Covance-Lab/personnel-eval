"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { toRadarData, type EvaluationScores } from "@/types/evaluation";

interface Props {
  scores: EvaluationScores;
  showSelf?: boolean;
  showAm?: boolean;
}

export default function EvaluationRadarChart({
  scores,
  showSelf = true,
  showAm = true,
}: Props) {
  const data = toRadarData(scores);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 12, fill: "#374151" }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 5]}
          tickCount={6}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
        />
        {showSelf && (
          <Radar
            name="本人評価"
            dataKey="self"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        )}
        {showAm && (
          <Radar
            name="AM評価"
            dataKey="am"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        )}
        <Tooltip
          formatter={(value) => [`${value} / 5`]}
        />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}
