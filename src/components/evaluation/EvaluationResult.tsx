"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend,
} from "recharts";
import { Award } from "lucide-react";

interface EvalData {
  year: number;
  month: number;
  workload_score: number | null;
  performance_score: number | null;
  dm_count: number | null;
  b_set_rate: number | null;
  discipline_self: number | null;
  absorption_self: number | null;
  contribution_self: number | null;
  thinking_self: number | null;
  discipline_other: number | null;
  absorption_other: number | null;
  contribution_other: number | null;
  thinking_other: number | null;
}

const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: "5点 よくできている",      color: "text-green-600" },
  4: { label: "4点 まあまあできている",   color: "text-blue-600" },
  3: { label: "3点 人並みにできている",   color: "text-yellow-600" },
  2: { label: "2点 あまりできていない",   color: "text-orange-600" },
  1: { label: "1点 全くできていない",     color: "text-red-600" },
};

function QuantScore({ label, score, sub }: { label: string; score: number | null; sub?: string }) {
  if (score == null) return null;
  const info = SCORE_LABELS[score];
  return (
    <div className="bg-white rounded-xl border p-4 space-y-1">
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      <div className={`text-2xl font-bold ${info?.color ?? "text-gray-700"}`}>{score}<span className="text-sm font-normal text-gray-400 ml-0.5">点</span></div>
      <p className="text-xs text-gray-500">{info?.label.replace(/^\d点 /, "")}</p>
    </div>
  );
}

interface EvaluationResultProps {
  role: "Appointer" | "AM";
}

export default function EvaluationResult({ role }: EvaluationResultProps) {
  const [data, setData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    fetch(`/api/evaluation?year=${year}&month=${month}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setData(d?.result ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  // 前月ラベル
  const prevDate  = new Date(year, month - 2, 1);
  const prevLabel = `${prevDate.getFullYear()}年${prevDate.getMonth() + 1}月`;

  const radarData = [
    {
      subject: "規律",
      自己評価: data.discipline_self,
      他者評価: data.discipline_other != null ? Number(data.discipline_other.toFixed(1)) : null,
    },
    {
      subject: "吸収力",
      自己評価: data.absorption_self,
      他者評価: data.absorption_other != null ? Number(data.absorption_other.toFixed(1)) : null,
    },
    {
      subject: "組織貢献",
      自己評価: data.contribution_self,
      他者評価: data.contribution_other != null ? Number(data.contribution_other.toFixed(1)) : null,
    },
    {
      subject: "思考力",
      自己評価: data.thinking_self,
      他者評価: data.thinking_other != null ? Number(data.thinking_other.toFixed(1)) : null,
    },
  ];

  const hasQualitative = radarData.some((d) => d.自己評価 != null || d.他者評価 != null);

  return (
    <Card className="border border-indigo-200 bg-indigo-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
          <Award className="w-4 h-4" />
          {year}年{month}月 人事評価結果
        </CardTitle>
        <p className="text-xs text-indigo-600">管理者が公開した評価結果です</p>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* 定量評価（Appointerのみ） */}
        {role === "Appointer" && (data.workload_score != null || data.performance_score != null) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">定量評価（{prevLabel}実績）</p>
            <div className="grid grid-cols-2 gap-3">
              <QuantScore
                label="稼働量"
                score={data.workload_score}
                sub={data.dm_count != null ? `DM数: ${data.dm_count.toLocaleString()}通` : undefined}
              />
              <QuantScore
                label="成果"
                score={data.performance_score}
                sub={data.b_set_rate != null ? `B設定率: ${Number(data.b_set_rate).toFixed(2)}%` : undefined}
              />
            </div>
          </div>
        )}

        {/* 定性評価レーダーチャート */}
        {hasQualitative && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">定性評価（アンケート結果）</p>
            <p className="text-xs text-gray-400">
              <span className="text-indigo-500 font-medium">■ 自己評価</span>
              　<span className="text-pink-500 font-medium">■ 他者評価</span>（AM・営業マンの平均）
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <Radar name="自己評価" dataKey="自己評価" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                <Radar name="他者評価" dataKey="他者評価" stroke="#ec4899" fill="#ec4899" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>

            {/* スコア詳細テーブル */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">項目</th>
                    <th className="text-center px-3 py-2 font-medium text-indigo-600">自己評価</th>
                    <th className="text-center px-3 py-2 font-medium text-pink-600">他者評価</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {[
                    { label: "規律",    self: data.discipline_self,   other: data.discipline_other },
                    { label: "吸収力",  self: data.absorption_self,   other: data.absorption_other },
                    { label: "組織貢献", self: data.contribution_self, other: data.contribution_other },
                    { label: "思考力",  self: data.thinking_self,     other: data.thinking_other },
                  ].map(({ label, self, other }) => (
                    <tr key={label}>
                      <td className="px-3 py-2 font-medium text-gray-700">{label}</td>
                      <td className="px-3 py-2 text-center text-indigo-600 font-semibold">{self ?? "—"}</td>
                      <td className="px-3 py-2 text-center text-pink-600 font-semibold">
                        {other != null ? Number(other).toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
