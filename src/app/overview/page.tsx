"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ─── 型定義 ────────────────────────────────────────────────────────
interface TeamStats {
  team: string;
  appointerCount: number;
  dmCount: number;
  bSetCount: number;
  bSetRate: number;
}
interface Aggregate {
  bExecCount: number;
  aSetCount: number;
  aExecCount: number;
  contractCount: number;
  revenue: number;
}
interface TeamAgg {
  dmCount?:      number; // 全体シートF7（全体行のみ）
  bSetCount:     number;
  bExecCount:    number;
  aSetCount:     number;
  aExecCount:    number;
  contractCount: number;
}

interface TrendPoint {
  label: string;
  year: number;
  month: number;
  overall: TeamStats;
  byTeam: TeamStats[];
  aggregate: Aggregate | null;
  teamAggregates?: Record<string, TeamAgg>;
}

const TEAMS = ["辻利", "LUMIA", "Covance"] as const;
type TeamName = typeof TEAMS[number];

const TEAM_COLOR: Record<string, string> = {
  辻利: "#6366f1", LUMIA: "#ec4899", Covance: "#f59e0b",
};

// ─── 率の安全な計算 ─────────────────────────────────────────────────
function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

// ─── 指標定義 ─────────────────────────────────────────────────────
type MetricKey =
  | "DM数" | "B設定数" | "B実施数" | "A設定数" | "A実施数" | "契約数" | "売上"
  | "B設定率" | "B実施率" | "A設定率" | "A実施率" | "契約率";

const COUNT_METRICS: MetricKey[] = ["DM数", "B設定数", "B実施数", "A設定数", "A実施数", "契約数", "売上"];
const RATE_METRICS:  MetricKey[] = ["B設定率", "B実施率", "A設定率", "A実施率", "契約率"];

const LINE_COLORS: Record<MetricKey, string> = {
  "DM数":    "#6366f1",
  "B設定数": "#ec4899",
  "B実施数": "#22c55e",
  "A設定数": "#f97316",
  "A実施数": "#0ea5e9",
  "契約数":  "#a16207",
  "売上":    "#047857",
  "B設定率": "#f59e0b",
  "B実施率": "#14b8a6",
  "A設定率": "#8b5cf6",
  "A実施率": "#e11d48",
  "契約率":  "#b91c1c",
};

const UNIT: Record<MetricKey, string> = {
  "DM数": "件", "B設定数": "件", "B実施数": "件", "A設定数": "件", "A実施数": "件", "契約数": "件", "売上": "円",
  "B設定率": "%", "B実施率": "%", "A設定率": "%", "A実施率": "%", "契約率": "%",
};

// ─── チャートデータ構築 ──────────────────────────────────────────────
function buildChartPoint(
  label: string,
  appo: TeamStats,
  agg: Aggregate | null,
  teamAgg?: TeamAgg | null,
): Record<string, number | string> {
  // DM数: teamAgg.dmCount優先（全体シートF7）、なければperformance_records集計
  const dmCount       = teamAgg?.dmCount    ?? appo.dmCount;
  const bSetCount     = teamAgg?.bSetCount  ?? appo.bSetCount;
  const bExecCount    = teamAgg?.bExecCount ?? agg?.bExecCount ?? 0;
  const aSetCount     = teamAgg?.aSetCount  ?? agg?.aSetCount  ?? 0;
  const aExecCount    = teamAgg?.aExecCount ?? agg?.aExecCount ?? 0;
  const contractCount = teamAgg?.contractCount ?? agg?.contractCount ?? 0;
  const revenue       = agg?.revenue ?? 0;

  return {
    label,
    "DM数":    dmCount,
    "B設定数": bSetCount,
    "B設定率": pct(bSetCount, dmCount),
    "B実施数": bExecCount,
    "B実施率": pct(bExecCount, bSetCount),
    "A設定数": aSetCount,
    "A設定率": pct(aSetCount, bExecCount),
    "A実施数": aExecCount,
    "A実施率": pct(aExecCount, aSetCount),
    "契約数":  contractCount,
    "契約率":  pct(contractCount, aExecCount),
    "売上":    revenue,
  };
}

// ─── メインページ ────────────────────────────────────────────────────
export default function OverviewPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [trend,   setTrend]   = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // フィルター
  const [chartTeam,     setChartTeam]     = useState<"全体" | TeamName>("全体");
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(new Set(["DM数", "B設定数"]));
  const isRateMode = [...activeMetrics].some((m) => RATE_METRICS.includes(m));

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { setTrend(d.trend ?? []); })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>;
  }

  const { nickname, name, image, role, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "ユーザー";

  // チャートデータ
  const chartData = trend.map((t) => {
    if (chartTeam === "全体") {
      const overallTeamAgg = t.teamAggregates?.["全体"] ?? null;
      return buildChartPoint(t.label, t.overall, t.aggregate, overallTeamAgg);
    }
    const teamStats = t.byTeam.find((b) => b.team === chartTeam) ?? t.overall;
    const tAgg = t.teamAggregates?.[chartTeam] ?? null;
    return buildChartPoint(t.label, teamStats, null, tAgg);
  });

  function toggleMetric(m: MetricKey) {
    const mIsRate = RATE_METRICS.includes(m);
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      const prevHasRate = [...prev].some((k) => RATE_METRICS.includes(k));
      if (mIsRate && !prevHasRate) return new Set([m]);
      if (!mIsRate && prevHasRate)  return new Set([m]);
      if (next.has(m)) { next.delete(m); if (next.size === 0) next.add(m); }
      else { next.add(m); }
      return next;
    });
  }

  return (
    <PageLayout title="全体実績" role={role ?? "Admin"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">月次推移</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* チームフィルター */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">チーム</p>
              <div className="flex flex-wrap gap-1.5">
                {(["全体", ...TEAMS] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartTeam(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      chartTeam === t
                        ? "text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    style={chartTeam === t ? { backgroundColor: t === "全体" ? "#6366f1" : TEAM_COLOR[t] } : {}}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 集計フィルター（2段） */}
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">件数・売上（同時選択可）</p>
                <div className="flex flex-wrap gap-1.5">
                  {COUNT_METRICS.map((m) => {
                    const on = activeMetrics.has(m);
                    return (
                      <button key={m} onClick={() => toggleMetric(m)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                        style={on ? { backgroundColor: LINE_COLORS[m] } : {}}
                      >{m}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">率（件数と同時表示不可）</p>
                <div className="flex flex-wrap gap-1.5">
                  {RATE_METRICS.map((m) => {
                    const on = activeMetrics.has(m);
                    return (
                      <button key={m} onClick={() => toggleMetric(m)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                        style={on ? { backgroundColor: LINE_COLORS[m] } : {}}
                      >{m}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* グラフ */}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  unit={isRateMode ? "%" : ""}
                  tickFormatter={(v) => {
                    if (!isRateMode && v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                    if (!isRateMode && v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                    return String(v);
                  }}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const n = Number(value);
                    const unit = UNIT[String(name) as MetricKey] ?? "";
                    if (unit === "円") return [`¥${n.toLocaleString()}`, name];
                    if (unit === "%")  return [`${n}%`, name];
                    return [`${n.toLocaleString()}件`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {([...activeMetrics] as MetricKey[]).map((m) => (
                  <Line
                    key={m}
                    type="monotone"
                    dataKey={m}
                    stroke={LINE_COLORS[m]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

          </CardContent>
        </Card>

      </div>
    </PageLayout>
  );
}
