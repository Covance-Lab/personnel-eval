"use client";

import {
  EVALUATION_AXES,
  type EvaluationScores,
} from "@/types/evaluation";

interface Props {
  scores: EvaluationScores;
}

const DOT_COLORS = ["bg-gray-200", "bg-gray-200", "bg-gray-200", "bg-gray-200", "bg-gray-200"];

function ScoreDots({ score, color }: { score: number | null; color: string }) {
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-4 h-4 rounded-full inline-block transition-colors ${
            score !== null && i <= score ? color : "bg-gray-200"
          }`}
        />
      ))}
      <span className="ml-2 text-sm font-semibold text-gray-700">
        {score ?? "－"} / 5
      </span>
    </div>
  );
}

export default function EvaluationScoreTable({ scores }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-600 w-32">評価軸</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600">本人評価</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600">AM評価</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-600">差異</th>
          </tr>
        </thead>
        <tbody>
          {EVALUATION_AXES.map((ax) => {
            const self = scores[ax.key].selfScore;
            const am = scores[ax.key].amScore;
            const diff = self !== null && am !== null ? am - self : null;
            return (
              <tr key={ax.key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: ax.color }}
                    />
                    <span className="font-medium text-gray-800">{ax.label}</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <ScoreDots score={self} color="bg-indigo-500" />
                </td>
                <td className="py-3 px-3">
                  <ScoreDots score={am} color="bg-amber-500" />
                </td>
                <td className="py-3 px-3">
                  {diff !== null ? (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        diff > 0
                          ? "text-green-700 bg-green-100"
                          : diff < 0
                          ? "text-red-700 bg-red-100"
                          : "text-gray-600 bg-gray-100"
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff === 0 ? "±0" : diff}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">－</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
