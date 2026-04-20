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
interface TeamAgg {
  dmCount?:      number;
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
// 全体の数字は 全て 集計シート（team_monthly_aggregates["全体"]）から取得。
// dm_count がまだ同期されていない場合は performance_records にフォールバック。
function OverallCard({
  curr, prev, currAgg, prevAgg, currTeamAgg, prevTeamAgg,
}: {
  curr: TeamStats;
  prev: TeamStats;
  currAgg: Aggregate | null;
  prevAgg: Aggregate | null;
  currTeamAgg: TeamAgg | null;
  prevTeamAgg: TeamAgg | null;
}) {
  // 全体数値: 集計シート優先
  const dmC    = currTeamAgg?.dmCount    ?? curr.dmCount;
  const dmP    = prevTeamAgg?.dmCount    ?? prev.dmCount;
  const bSetC  = currTeamAgg?.bSetCount  ?? curr.bSetCount;
  const bSetP  = prevTeamAgg?.bSetCount  ?? prev.bSetCount;
  const bExecC = currTeamAgg?.bExecCount ?? currAgg?.bExecCount ?? 0;
  const bExecP = prevTeamAgg?.bExecCount ?? prevAgg?.bExecCount ?? 0;
  const aSetC  = currTeamAgg?.aSetCount  ?? currAgg?.aSetCount  ?? 0;
  const aSetP  = prevTeamAgg?.aSetCount  ?? prevAgg?.aSetCount  ?? 0;
  const aExecC = currTeamAgg?.aExecCount ?? currAgg?.aExecCount ?? 0;
  const aExecP = prevTeamAgg?.aExecCount ?? prevAgg?.aExecCount ?? 0;
  const contractC = currTeamAgg?.contractCount ?? currAgg?.contractCount ?? 0;
  const contractP = prevTeamAgg?.contractCount ?? prevAgg?.contractCount ?? 0;
  const revenueC  = currAgg?.revenue ?? 0;
  const revenueP  = prevAgg?.revenue ?? 0;

  const bSetRateC  = pct(bSetC,     dmC);
  const bSetRateP  = pct(bSetP,     dmP);
  const bExecRateC = pct(bExecC,    bSetC);
  const bExecRateP = pct(bExecP,    bSetP);
  const aSetRateC  = pct(aSetC,     bExecC);
  const aSetRateP  = pct(aSetP,     bExecP);
  const aExecRateC = pct(aExecC,    aSetC);
  const aExecRateP = pct(aExecP,    aSetP);
  const contractRateC = pct(contractC, aExecC);
  const contractRateP = pct(contractP, aExecP);

  const hasAgg = !!(currTeamAgg || currAgg);

  type Item = { label: string; curr: number; prev: number; suffix: string; money?: boolean; dimmed?: boolean } | null;
  const pairs: [Item, Item][] = [
    [
      { label: "DM",    curr: dmC,    prev: dmP,    suffix: "件" },
      null,
    ],
    [
      { label: "B設定", curr: bSetC,  prev: bSetP,  suffix: "件" },
      { label: "B設定率", curr: bSetRateC,  prev: bSetRateP,  suffix: "%" },
    ],
    [
      { label: "B実施", curr: bExecC, prev: bExecP, suffix: "件",  dimmed: !hasAgg },
      { label: "B実施率", curr: bExecRateC, prev: bExecRateP, suffix: "%", dimmed: !hasAgg },
    ],
    [
      { label: "A設定", curr: aSetC,  prev: aSetP,  suffix: "件",  dimmed: !hasAgg },
      { label: "A設定率", curr: aSetRateC,  prev: aSetRateP,  suffix: "%", dimmed: !hasAgg },
    ],
    [
      { label: "A実施", curr: aExecC, prev: aExecP, suffix: "件",  dimmed: !hasAgg },
      { label: "A実施率", curr: aExecRateC, prev: aExecRateP, suffix: "%", dimmed: !hasAgg },
    ],
    [
      { label: "契約",  curr: contractC, prev: contractP, suffix: "件", dimmed: !hasAgg },
      { label: "契約率", curr: contractRateC, prev: contractRateP, suffix: "%", dimmed: !hasAgg },
    ],
    [
      { label: "売上",  curr: revenueC, prev: revenueP, suffix: "円", money: true, dimmed: !currAgg },
      null,
    ],
  ];

  function StatCell({ item }: { item: Item }) {
    if (!item) return <div />;
    const { label, curr: c, prev: p, suffix, money, dimmed } = item;
    return (
      <div className={`rounded-xl border p-3 space-y-1 ${dimmed ? "opacity-40 bg-gray-50" : "bg-white"}`}>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
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
        {!hasAgg && (
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

// ─── チーム全パイプラインカード ─────────────────────────────────────
// 各チームのDM数: performance_records（スプレッドシート設定のC列合計）
// B設定〜契約: team_monthly_aggregates（全体シートのA列カウント等）
function TeamPipelineCard({
  team, curr, prev, currAgg, prevAgg,
}: {
  team: string;
  curr: TeamStats | null;
  prev: TeamStats | null;
  currAgg: TeamAgg | null;
  prevAgg: TeamAgg | null;
}) {
  const c  = curr  ?? { appointerCount: 0, dmCount: 0, bSetCount: 0, bSetRate: 0, team };
  const p  = prev  ?? { appointerCount: 0, dmCount: 0, bSetCount: 0, bSetRate: 0, team };

  const bSetC  = currAgg?.bSetCount  ?? c.bSetCount;
  const bSetP  = prevAgg?.bSetCount  ?? p.bSetCount;
  const bExecC = currAgg?.bExecCount ?? 0;
  const bExecP = prevAgg?.bExecCount ?? 0;
  const aSetC  = currAgg?.aSetCount  ?? 0;
  const aSetP  = prevAgg?.aSetCount  ?? 0;
  const aExecC = currAgg?.aExecCount ?? 0;
  const aExecP = prevAgg?.aExecCount ?? 0;
  const contractC = currAgg?.contractCount ?? 0;
  const contractP = prevAgg?.contractCount ?? 0;

  const bSetRateC  = pct(bSetC, c.dmCount);
  const bSetRateP  = pct(bSetP, p.dmCount);
  const bExecRateC = pct(bExecC, bSetC);
  const bExecRateP = pct(bExecP, bSetP);
  const aSetRateC  = pct(aSetC,  bExecC);
  const aSetRateP  = pct(aSetP,  bExecP);
  const aExecRateC = pct(aExecC, aSetC);
  const aExecRateP = pct(aExecP, aSetP);
  const contractRateC = pct(contractC, aExecC);
  const contractRateP = pct(contractP, aExecP);

  const color = TEAM_COLOR[team] ?? "#6366f1";

  type Row = [
    { label: string; curr: number; prev: number; suffix: string },
    { label: string; curr: number; prev: number; suffix: string } | null,
  ];
  const rows: Row[] = [
    [{ label: "DM",    curr: c.dmCount, prev: p.dmCount, suffix: "件" }, null],
    [{ label: "B設定", curr: bSetC,    prev: bSetP,   suffix: "件" },
     { label: "B設定率", curr: bSetRateC, prev: bSetRateP, suffix: "%" }],
    [{ label: "B実施", curr: bExecC,   prev: bExecP,  suffix: "件" },
     { label: "B実施率", curr: bExecRateC, prev: bExecRateP, suffix: "%" }],
    [{ label: "A設定", curr: aSetC,    prev: aSetP,   suffix: "件" },
     { label: "A設定率", curr: aSetRateC, prev: aSetRateP, suffix: "%" }],
    [{ label: "A実施", curr: aExecC,   prev: aExecP,  suffix: "件" },
     { label: "A実施率", curr: aExecRateC, prev: aExecRateP, suffix: "%" }],
    [{ label: "契約",  curr: contractC, prev: contractP, suffix: "件" },
     { label: "契約率", curr: contractRateC, prev: contractRateP, suffix: "%" }],
  ];

  function Cell({ item }: { item: { label: string; curr: number; prev: number; suffix: string } | null }) {
    if (!item) return <div />;
    const noAgg = !currAgg && item.label !== "DM";
    return (
      <div className={`rounded-xl border p-3 space-y-1 ${noAgg ? "opacity-40 bg-gray-50" : "bg-white"}`}>
        <p className="text-sm font-semibold text-gray-700">{item.label}</p>
        <p className="text-xl font-bold leading-none">
          {item.curr.toLocaleString()}
          <span className="text-xs font-normal text-gray-400 ml-0.5">{item.suffix}</span>
        </p>
        <Diff curr={item.curr} prev={item.prev} suffix={item.suffix} />
      </div>
    );
  }

  return (
    <Card className="border-t-4" style={{ borderTopColor: color }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold" style={{ color }}>{team}</CardTitle>
        <p className="text-xs text-gray-400">アポインター {c.appointerCount}人</p>
        {!currAgg && <p className="text-xs text-amber-600 mt-1">※ B実施以降は「チーム別集計を同期」で表示されます</p>}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map(([left, right], i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Cell item={left} />
              {right ? <Cell item={right} /> : <div />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── チーム別カード（Admin以外） ─────────────────────────────────────
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

  const [current,  setCurrent]  = useState<{ year: number; month: number; overall: TeamStats; byTeam: TeamStats[] } | null>(null);
  const [previous, setPrevious] = useState<{ year: number; month: number; overall: TeamStats; byTeam: TeamStats[] } | null>(null);
  const [trend,    setTrend]    = useState<TrendPoint[]>([]);
  const [currAgg,  setCurrAgg]  = useState<Aggregate | null>(null);
  const [prevAgg,  setPrevAgg]  = useState<Aggregate | null>(null);
  const [currTeamAgg, setCurrTeamAgg] = useState<Record<string, TeamAgg>>({});
  const [prevTeamAgg, setPrevTeamAgg] = useState<Record<string, TeamAgg>>({});
  const [loading,  setLoading]  = useState(true);

  // チャートフィルター
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
      .then((d) => {
        setCurrent(d.current);
        setPrevious(d.previous);
        setTrend(d.trend ?? []);
        setCurrAgg(d.currentAggregate ?? null);
        setPrevAgg(d.previousAggregate ?? null);
        setCurrTeamAgg(d.currentTeamAggregates ?? {});
        setPrevTeamAgg(d.previousTeamAggregates ?? {});
      })
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
      return buildChartPoint(t.label, t.overall, t.aggregate, t.teamAggregates?.["全体"] ?? null);
    }
    const teamStats = t.byTeam.find((b) => b.team === chartTeam) ?? t.overall;
    return buildChartPoint(t.label, teamStats, null, t.teamAggregates?.[chartTeam] ?? null);
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

  // Sales: 自チームのデータを先頭に
  const isSales = role === "Sales";
  const myTeamStats     = team ? current?.byTeam.find((b) => b.team === team)  ?? null : null;
  const myTeamPrevStats = team ? previous?.byTeam.find((b) => b.team === team) ?? null : null;
  const myTeamAgg     = team ? currTeamAgg[team] ?? null : null;
  const myTeamPrevAgg = team ? prevTeamAgg[team] ?? null : null;

  return (
    <PageLayout title="全体実績" role={role ?? "Admin"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {/* Sales: 自チームを先頭に */}
        {isSales && team && current && (
          <div>
            <p className="text-xs text-gray-400 mb-3">
              {current.year}年{current.month}月 の自チーム実績（{team}）
            </p>
            <TeamPipelineCard
              team={team}
              curr={myTeamStats}
              prev={myTeamPrevStats}
              currAgg={myTeamAgg}
              prevAgg={myTeamPrevAgg}
            />
          </div>
        )}

        {/* ① 全体数字（集計シートから） */}
        {current && (
          <div>
            <p className="text-xs text-gray-400 mb-3">
              {current.year}年{current.month}月 の全体実績
            </p>
            <OverallCard
              curr={current.overall}
              prev={previous?.overall ?? current.overall}
              currAgg={currAgg}
              prevAgg={prevAgg}
              currTeamAgg={currTeamAgg["全体"] ?? null}
              prevTeamAgg={prevTeamAgg["全体"] ?? null}
            />
          </div>
        )}

        {/* ② チームごとの数字 */}
        {current && (
          <div>
            <p className="text-xs text-gray-400 mb-3">チーム別（前月比）</p>
            {role === "Admin" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TEAMS.map((t) => (
                  <TeamPipelineCard
                    key={t}
                    team={t}
                    curr={current.byTeam.find((b) => b.team === t) ?? null}
                    prev={previous?.byTeam.find((b) => b.team === t) ?? null}
                    currAgg={currTeamAgg[t] ?? null}
                    prevAgg={prevTeamAgg[t] ?? null}
                  />
                ))}
              </div>
            ) : (
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
            )}
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
