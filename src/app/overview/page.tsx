"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
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
interface TrendPoint {
  label: string;
  year: number;
  month: number;
  overall: TeamStats;
  byTeam: TeamStats[];
  aggregate: Aggregate | null;
}

const TEAMS = ["辻利", "LUMIA", "Covance"] as const;
type TeamName = typeof TEAMS[number];

const TEAM_COLOR: Record<string, string> = {
  辻利: "#6366f1", LUMIA: "#ec4899", Covance: "#f59e0b",
};

// ─── 前月比 ────────────────────────────────────────────────────────
function Diff({ curr, prev, suffix = "" }: { curr: number; prev: number; suffix?: string }) {
  const diff = curr - prev;
  const abs  = Math.abs(diff);
  if (diff === 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
      <Minus className="w-3 h-3" />前月同
    </span>
  );
  if (diff > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
      <TrendingUp className="w-3 h-3" />+{abs.toLocaleString()}{suffix}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-500">
      <TrendingDown className="w-3 h-3" />−{abs.toLocaleString()}{suffix}
    </span>
  );
}

// ─── 率の安全な計算 ─────────────────────────────────────────────────
function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

// ─── 今月全体カード ─────────────────────────────────────────────────
function OverallCard({
  curr, prev, currAgg, prevAgg,
}: {
  curr: TeamStats;
  prev: TeamStats;
  currAgg: Aggregate | null;
  prevAgg: Aggregate | null;
}) {
  const bExecRate     = pct(currAgg?.bExecCount ?? 0, curr.bSetCount);
  const aSetRate      = pct(currAgg?.aSetCount  ?? 0, currAgg?.bExecCount ?? 0);
  const aExecRate     = pct(currAgg?.aExecCount ?? 0, currAgg?.aSetCount  ?? 0);
  const contractRate  = pct(currAgg?.contractCount ?? 0, currAgg?.aExecCount ?? 0);

  const prevBExecRate    = pct(prevAgg?.bExecCount ?? 0, prev.bSetCount);
  const prevASetRate     = pct(prevAgg?.aSetCount  ?? 0, prevAgg?.bExecCount ?? 0);
  const prevAExecRate    = pct(prevAgg?.aExecCount ?? 0, prevAgg?.aSetCount  ?? 0);
  const prevContractRate = pct(prevAgg?.contractCount ?? 0, prevAgg?.aExecCount ?? 0);

  // 2列表示用ペア: [左カラム, 右カラム | null]
  const pairs: Array<[
    { label: string; curr: number; prev: number; suffix: string; noAgg?: boolean; money?: boolean } | null,
    { label: string; curr: number; prev: number; suffix: string; noAgg?: boolean; money?: boolean } | null,
  ]> = [
    [
      { label: "DM",    curr: curr.dmCount,   prev: prev.dmCount,   suffix: "件" },
      null,
    ],
    [
      { label: "B設定", curr: curr.bSetCount, prev: prev.bSetCount, suffix: "件" },
      { label: "B設定率", curr: curr.bSetRate, prev: prev.bSetRate, suffix: "%" },
    ],
    [
      { label: "B実施", curr: currAgg?.bExecCount ?? 0, prev: prevAgg?.bExecCount ?? 0, suffix: "件", noAgg: !currAgg },
      { label: "B実施率", curr: bExecRate, prev: prevBExecRate, suffix: "%", noAgg: !currAgg },
    ],
    [
      { label: "A設定", curr: currAgg?.aSetCount ?? 0, prev: prevAgg?.aSetCount ?? 0, suffix: "件", noAgg: !currAgg },
      { label: "A設定率", curr: aSetRate, prev: prevASetRate, suffix: "%", noAgg: !currAgg },
    ],
    [
      { label: "A実施", curr: currAgg?.aExecCount ?? 0, prev: prevAgg?.aExecCount ?? 0, suffix: "件", noAgg: !currAgg },
      { label: "A実施率", curr: aExecRate, prev: prevAExecRate, suffix: "%", noAgg: !currAgg },
    ],
    [
      { label: "契約", curr: currAgg?.contractCount ?? 0, prev: prevAgg?.contractCount ?? 0, suffix: "件", noAgg: !currAgg },
      { label: "契約率", curr: contractRate, prev: prevContractRate, suffix: "%", noAgg: !currAgg },
    ],
    [
      { label: "売上", curr: currAgg?.revenue ?? 0, prev: prevAgg?.revenue ?? 0, suffix: "円", noAgg: !currAgg, money: true },
      null,
    ],
  ];

  function StatCell({ item }: { item: { label: string; curr: number; prev: number; suffix: string; noAgg?: boolean; money?: boolean } | null }) {
    if (!item) return <div />;
    const { label, curr: c, prev: p, suffix, noAgg, money } = item;
    return (
      <div className={`rounded-xl border p-3 space-y-1 ${noAgg ? "opacity-40 bg-gray-50" : "bg-white"}`}>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold leading-none">
          {money ? `¥${c.toLocaleString()}` : c.toLocaleString()}
          {!money && <span className="text-xs font-normal text-gray-400 ml-0.5">{suffix}</span>}
        </p>
        <Diff curr={c} prev={p} suffix={money ? "" : suffix} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700">全体</CardTitle>
        {!currAgg && (
          <p className="text-xs text-amber-600 mt-1">
            ※ B実施以降は集計シートを同期すると表示されます（Admin設定 → 集計シート設定）
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pairs.map(([left, right], i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <StatCell item={left} />
              {right ? <StatCell item={right} /> : <div />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── チーム別カード ─────────────────────────────────────────────────
function TeamCard({
  team, curr, prev,
}: {
  team: TeamName;
  curr: TeamStats | null;
  prev: TeamStats | null;
}) {
  const c = curr ?? { appointerCount: 0, dmCount: 0, bSetCount: 0, bSetRate: 0, team };
  const p = prev ?? { appointerCount: 0, dmCount: 0, bSetCount: 0, bSetRate: 0, team };
  const color = TEAM_COLOR[team];

  return (
    <Card className="border-t-4" style={{ borderTopColor: color }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold" style={{ color }}>{team}</CardTitle>
        <p className="text-xs text-gray-400">アポインター {c.appointerCount}人</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {[
            { label: "DM数",    cv: c.dmCount,   pv: p.dmCount,   suffix: "件" },
            { label: "B設定数", cv: c.bSetCount, pv: p.bSetCount, suffix: "件" },
            { label: "B設定率", cv: c.bSetRate,  pv: p.bSetRate,  suffix: "%" },
          ].map(({ label, cv, pv, suffix }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{label}</span>
              <div className="text-right">
                <span className="text-sm font-bold">{cv.toLocaleString()}{suffix}</span>
                <div className="flex justify-end">
                  <Diff curr={cv} prev={pv} suffix={suffix} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 指標定義 ─────────────────────────────────────────────────────
type MetricKey =
  | "DM数" | "B設定数" | "B設定率"
  | "B実施数" | "B実施率" | "A設定数" | "A設定率"
  | "A実施数" | "A実施率" | "契約数" | "契約率" | "売上";

const APPO_METRICS: MetricKey[] = ["DM数", "B設定数", "B設定率"];
const AGG_METRICS:  MetricKey[] = ["B実施数", "B実施率", "A設定数", "A設定率", "A実施数", "A実施率", "契約数", "契約率", "売上"];

const LINE_COLORS: Record<MetricKey, string> = {
  "DM数":    "#6366f1",
  "B設定数": "#ec4899",
  "B設定率": "#f59e0b",
  "B実施数": "#22c55e",
  "B実施率": "#14b8a6",
  "A設定数": "#f97316",
  "A設定率": "#8b5cf6",
  "A実施数": "#0ea5e9",
  "A実施率": "#e11d48",
  "契約数":  "#a16207",
  "契約率":  "#b91c1c",
  "売上":    "#047857",
};

const UNIT: Record<MetricKey, string> = {
  "DM数": "件", "B設定数": "件", "B設定率": "%",
  "B実施数": "件", "B実施率": "%", "A設定数": "件", "A設定率": "%",
  "A実施数": "件", "A実施率": "%", "契約数": "件", "契約率": "%", "売上": "円",
};

// ─── チャートデータ構築 ──────────────────────────────────────────────
function buildChartPoint(
  label: string,
  appo: TeamStats,
  agg: Aggregate | null,
): Record<string, number | string> {
  const bExecRate    = pct(agg?.bExecCount ?? 0, appo.bSetCount);
  const aSetRate     = pct(agg?.aSetCount  ?? 0, agg?.bExecCount ?? 0);
  const aExecRate    = pct(agg?.aExecCount ?? 0, agg?.aSetCount  ?? 0);
  const contractRate = pct(agg?.contractCount ?? 0, agg?.aExecCount ?? 0);

  return {
    label,
    "DM数":    appo.dmCount,
    "B設定数": appo.bSetCount,
    "B設定率": appo.bSetRate,
    "B実施数": agg?.bExecCount    ?? 0,
    "B実施率": bExecRate,
    "A設定数": agg?.aSetCount     ?? 0,
    "A設定率": aSetRate,
    "A実施数": agg?.aExecCount    ?? 0,
    "A実施率": aExecRate,
    "契約数":  agg?.contractCount ?? 0,
    "契約率":  contractRate,
    "売上":    agg?.revenue        ?? 0,
  };
}

// ─── メインページ ────────────────────────────────────────────────────
export default function OverviewPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [current,  setCurrent]  = useState<{ year: number; month: number; overall: TeamStats; byTeam: TeamStats[] } | null>(null);
  const [previous, setPrevious] = useState<{ year: number; month: number; overall: TeamStats; byTeam: TeamStats[] } | null>(null);
  const [trend,    setTrend]    = useState<TrendPoint[]>([]);
  const [currAgg,  setCurrAgg]  = useState<Aggregate | null>(null);
  const [prevAgg,  setPrevAgg]  = useState<Aggregate | null>(null);
  const [loading,  setLoading]  = useState(true);

  // フィルター
  const [chartTeam,    setChartTeam]    = useState<"全体" | TeamName>("全体");
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(new Set(["DM数", "B設定数"]));

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        setCurrent(d.current);
        setPrevious(d.previous);
        setTrend(d.trend ?? []);
        setCurrAgg(d.currentAggregate ?? null);
        setPrevAgg(d.previousAggregate ?? null);
      })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>;
  }

  const { nickname, name, image, role, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "管理者";

  // チャートデータ
  const chartData = trend.map((t) => {
    if (chartTeam === "全体") {
      return buildChartPoint(t.label, t.overall, t.aggregate);
    }
    const teamStats = t.byTeam.find((b) => b.team === chartTeam) ?? t.overall;
    // チーム別は集計データなし（売上・B実施以降はnull扱い）
    return buildChartPoint(t.label, teamStats, null);
  });

  // チーム別の場合、集計系指標は表示できない
  const isAggMetric = (m: MetricKey) => AGG_METRICS.includes(m);
  const teamIsFiltered = chartTeam !== "全体";

  function toggleMetric(m: MetricKey) {
    if (teamIsFiltered && isAggMetric(m)) return; // チーム別では集計指標は無効
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(m)) { next.delete(m); } else { next.add(m); }
      return next;
    });
  }

  // チーム変更時、集計指標を選択解除
  function handleTeamChange(t: "全体" | TeamName) {
    setChartTeam(t);
    if (t !== "全体") {
      setActiveMetrics((prev) => {
        const next = new Set([...prev].filter((m) => !isAggMetric(m)));
        if (next.size === 0) next.add("DM数");
        return next;
      });
    }
  }

  return (
    <PageLayout title="全体実績" role={role ?? "Admin"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {/* ① 今月の全体数字 */}
        {current && (
          <div>
            <p className="text-xs text-gray-400 mb-3">
              {current.year}年{current.month}月 の全体実績
            </p>
            <OverallCard curr={current.overall} prev={previous?.overall ?? current.overall} currAgg={currAgg} prevAgg={prevAgg} />
          </div>
        )}

        {/* ② チームごとの数字 */}
        {current && (
          <div>
            <p className="text-xs text-gray-400 mb-3">チーム別（前月比）</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TEAMS.map((t) => (
                <TeamCard
                  key={t}
                  team={t}
                  curr={current.byTeam.find((b) => b.team === t) ?? null}
                  prev={previous?.byTeam.find((b) => b.team === t) ?? null}
                />
              ))}
            </div>
          </div>
        )}

        {/* ③ 月次推移グラフ */}
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
                    onClick={() => handleTeamChange(t)}
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

            {/* 指標フィルター */}
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">アポインター実績（チーム別表示可）</p>
                <div className="flex flex-wrap gap-1.5">
                  {APPO_METRICS.map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleMetric(m)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        activeMetrics.has(m)
                          ? "text-white border-transparent"
                          : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                      }`}
                      style={activeMetrics.has(m) ? { backgroundColor: LINE_COLORS[m] } : {}}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={`text-xs mb-1.5 ${teamIsFiltered ? "text-gray-300" : "text-gray-500"}`}>
                  組織全体集計（全体のみ）
                  {teamIsFiltered && <span className="ml-1">— チーム別では使用不可</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {AGG_METRICS.map((m) => {
                    const disabled = teamIsFiltered;
                    const active   = activeMetrics.has(m) && !disabled;
                    return (
                      <button
                        key={m}
                        onClick={() => !disabled && toggleMetric(m)}
                        disabled={disabled}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          disabled
                            ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                            : active
                            ? "text-white border-transparent"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                        style={active ? { backgroundColor: LINE_COLORS[m] } : {}}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* グラフ */}
            {activeMetrics.size === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                指標を選択してください
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => {
                      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                      if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                      return String(v);
                    }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const n = Number(value);
                      const unit = UNIT[String(name) as MetricKey] ?? "";
                      if (unit === "円") return [`¥${n.toLocaleString()}`, name];
                      return [`${n.toLocaleString()}${unit}`, name];
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
            )}

          </CardContent>
        </Card>

      </div>
    </PageLayout>
  );
}
