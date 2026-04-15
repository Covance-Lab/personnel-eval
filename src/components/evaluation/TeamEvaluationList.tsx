"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Legend,
} from "recharts";
import { Award, ChevronDown, ChevronUp } from "lucide-react";

interface EvalResult {
  user_id: string;
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
  users?: {
    nickname?: string;
    name?: string;
    line_name?: string;
    role: string;
    team?: string;
  };
}

const SCORE_COLORS: Record<number, string> = {
  5: "bg-green-100 text-green-800",
  4: "bg-blue-100 text-blue-800",
  3: "bg-yellow-100 text-yellow-800",
  2: "bg-orange-100 text-orange-800",
  1: "bg-red-100 text-red-800",
};

const ROLE_LABELS: Record<string, string> = {
  Appointer: "アポインター",
  AM: "AM",
};

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${SCORE_COLORS[score] ?? "bg-gray-100 text-gray-600"}`}>
      {score}点
    </span>
  );
}

function EvalCard({ result }: { result: EvalResult }) {
  const [open, setOpen] = useState(false);
  const u = result.users;
  const displayName = u?.nickname ?? u?.name ?? u?.line_name ?? result.user_id;
  const role = u?.role ?? "";

  const radarData = [
    { subject: "稼働量",   自己: result.workload_score    ?? 0, 他者: result.workload_score    ?? 0 },
    { subject: "成果",     自己: result.performance_score ?? 0, 他者: result.performance_score ?? 0 },
    { subject: "規律",    自己: result.discipline_self   ?? 0, 他者: result.discipline_other   != null ? +Number(result.discipline_other).toFixed(1)   : 0 },
    { subject: "吸収力",  自己: result.absorption_self   ?? 0, 他者: result.absorption_other   != null ? +Number(result.absorption_other).toFixed(1)   : 0 },
    { subject: "組織貢献", 自己: result.contribution_self ?? 0, 他者: result.contribution_other != null ? +Number(result.contribution_other).toFixed(1) : 0 },
    { subject: "思考力",  自己: result.thinking_self     ?? 0, 他者: result.thinking_other     != null ? +Number(result.thinking_other).toFixed(1)     : 0 },
  ];
  const hasQualitative = radarData.some((d) => d.自己 !== 0 || d.他者 !== 0);

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      {/* ヘッダー行（常時表示） */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {/* 名前・ロール */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{displayName}</span>
            {role && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                {ROLE_LABELS[role] ?? role}
              </span>
            )}
            {u?.team && <span className="text-xs text-gray-400">{u.team}</span>}
          </div>
        </div>
        {/* 定量スコアサマリー（Appointerのみ） */}
        <div className="flex items-center gap-2 shrink-0">
          {role === "Appointer" && (
            <>
              <div className="text-center">
                <p className="text-xs text-gray-400 leading-none mb-0.5">稼働量</p>
                <ScorePill score={result.workload_score} />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 leading-none mb-0.5">成果</p>
                <ScorePill score={result.performance_score} />
              </div>
            </>
          )}
          {/* 定性サマリー（自己/他者平均） */}
          <div className="text-center">
            <p className="text-xs text-gray-400 leading-none mb-0.5">規律</p>
            <div className="flex gap-0.5 items-center">
              <span className="text-xs text-indigo-600 font-semibold">{result.discipline_self ?? "—"}</span>
              <span className="text-gray-300 text-xs">/</span>
              <span className="text-xs text-pink-600 font-semibold">{result.discipline_other != null ? Number(result.discipline_other).toFixed(1) : "—"}</span>
            </div>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-xs text-gray-400 leading-none mb-0.5">吸収力</p>
            <div className="flex gap-0.5 items-center">
              <span className="text-xs text-indigo-600 font-semibold">{result.absorption_self ?? "—"}</span>
              <span className="text-gray-300 text-xs">/</span>
              <span className="text-xs text-pink-600 font-semibold">{result.absorption_other != null ? Number(result.absorption_other).toFixed(1) : "—"}</span>
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />}
        </div>
      </button>

      {/* 展開詳細 */}
      {open && (
        <div className="px-4 pb-4 border-t space-y-4 pt-3">
          {/* 定量評価（Appointerのみ） */}
          {role === "Appointer" && (result.workload_score != null || result.performance_score != null) && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">定量評価（前月実績）</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">稼働量</p>
                  {result.dm_count != null && <p className="text-xs text-gray-400">DM: {result.dm_count.toLocaleString()}通</p>}
                  <ScorePill score={result.workload_score} />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">成果</p>
                  {result.b_set_rate != null && <p className="text-xs text-gray-400">B設定率: {Number(result.b_set_rate).toFixed(2)}%</p>}
                  <ScorePill score={result.performance_score} />
                </div>
              </div>
            </div>
          )}

          {/* 定性評価 */}
          {hasQualitative && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">定性評価</p>
              <p className="text-xs text-gray-400 mb-2">
                <span className="text-indigo-500 font-medium">■ 自己</span>
                　<span className="text-pink-500 font-medium">■ 他者</span>
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData} margin={{ top: 5, right: 25, bottom: 5, left: 25 }}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <Radar name="自己" dataKey="自己" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                  <Radar name="他者" dataKey="他者" stroke="#ec4899" fill="#ec4899" fillOpacity={0.2} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="rounded-lg border overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-600">項目</th>
                      <th className="text-center px-3 py-1.5 font-medium text-indigo-600">自己</th>
                      <th className="text-center px-3 py-1.5 font-medium text-pink-600">他者</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {[
                      { label: "規律",    s: result.discipline_self,   o: result.discipline_other },
                      { label: "吸収力",  s: result.absorption_self,   o: result.absorption_other },
                      { label: "組織貢献", s: result.contribution_self, o: result.contribution_other },
                      { label: "思考力",  s: result.thinking_self,     o: result.thinking_other },
                    ].map(({ label, s, o }) => (
                      <tr key={label}>
                        <td className="px-3 py-1.5 font-medium text-gray-700">{label}</td>
                        <td className="px-3 py-1.5 text-center text-indigo-600 font-semibold">{s ?? "—"}</td>
                        <td className="px-3 py-1.5 text-center text-pink-600 font-semibold">{o != null ? Number(o).toFixed(1) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TeamEvaluationListProps {
  title?: string;
}

export default function TeamEvaluationList({ title }: TeamEvaluationListProps) {
  const [results, setResults]   = useState<EvalResult[]>([]);
  const [loading, setLoading]   = useState(true);
  const [hasData, setHasData]   = useState(false);

  useEffect(() => {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    fetch(`/api/evaluation?view=team&year=${year}&month=${month}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.results && d.results.length > 0) {
          setResults(d.results);
          setHasData(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !hasData) return null;

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // ロール順（AM → Appointer）にソート
  const roleOrder: Record<string, number> = { AM: 0, Appointer: 1 };
  const sorted = [...results].sort((a, b) => {
    const ra = roleOrder[a.users?.role ?? ""] ?? 9;
    const rb = roleOrder[b.users?.role ?? ""] ?? 9;
    return ra !== rb ? ra - rb : (a.users?.nickname ?? "").localeCompare(b.users?.nickname ?? "");
  });

  return (
    <Card className="border border-indigo-200 bg-indigo-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
          <Award className="w-4 h-4" />
          {title ?? `${year}年${month}月 人事評価結果`}
        </CardTitle>
        <p className="text-xs text-indigo-600">
          管理者が公開した評価結果です
          <span className="ml-2 text-indigo-400">（行をタップで詳細表示）</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          <span className="text-indigo-500 font-medium">青</span>=自己評価
          　<span className="text-pink-500 font-medium">ピンク</span>=他者評価
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((r) => (
          <EvalCard key={r.user_id} result={r} />
        ))}
      </CardContent>
    </Card>
  );
}
