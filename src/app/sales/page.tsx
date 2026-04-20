"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import SurveyNotice from "@/components/survey/SurveyNotice";
import { useViewAs } from "@/contexts/ViewAsContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar,
} from "recharts";

// ─── 型 ────────────────────────────────────────────────────────────
interface TeamStats { team: string; dmCount: number; bSetCount: number; bSetRate: number; appointerCount: number; }
interface TeamAgg   { dmCount?: number; bSetCount: number; bExecCount: number; aSetCount: number; aExecCount: number; contractCount: number; }
interface TrendPoint {
  year: number; month: number; label: string;
  byTeam: TeamStats[];
  teamAggregates: Record<string, TeamAgg>;
}
interface StatsResponse {
  current:  { byTeam: TeamStats[] };
  previous: { byTeam: TeamStats[] };
  trend: TrendPoint[];
  currentTeamAggregates:  Record<string, TeamAgg>;
  previousTeamAggregates: Record<string, TeamAgg>;
}

// ─── ユーティリティ ─────────────────────────────────────────────────
function round1(n: number) { return Math.round(n * 10) / 10; }
function pct(num: number, den: number) { return den > 0 ? round1(num / den * 100) : 0; }

function Diff({ curr, prev, suffix = "" }: { curr: number; prev: number; suffix?: string }) {
  const diff = curr - prev;
  if (diff === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />前月同</span>;
  if (diff > 0)  return <span className="text-xs text-green-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{Math.abs(diff).toLocaleString()}{suffix}</span>;
  return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />−{Math.abs(diff).toLocaleString()}{suffix}</span>;
}

// ─── 2列ペア形式の実績カード ─────────────────────────────────────────
function StatsPairCard({
  curr, prev, currAgg, prevAgg,
}: {
  curr: TeamStats | null; prev: TeamStats | null;
  currAgg: TeamAgg | null; prevAgg: TeamAgg | null;
}) {
  const c  = curr  ?? { dmCount: 0, bSetCount: 0, bSetRate: 0, appointerCount: 0, team: "" };
  const p  = prev  ?? { dmCount: 0, bSetCount: 0, bSetRate: 0, appointerCount: 0, team: "" };
  const ca = currAgg  ?? null;
  const pa = prevAgg  ?? null;

  const bSetC = ca?.bSetCount ?? c.bSetCount;
  const bSetP = pa?.bSetCount ?? p.bSetCount;

  const bSetRateC  = pct(bSetC, c.dmCount);
  const bSetRateP  = pct(bSetP, p.dmCount);
  const bExecRateC = pct(ca?.bExecCount ?? 0, bSetC);
  const bExecRateP = pct(pa?.bExecCount ?? 0, bSetP);
  const aSetRateC  = pct(ca?.aSetCount ?? 0, ca?.bExecCount ?? 0);
  const aSetRateP  = pct(pa?.aSetCount ?? 0, pa?.bExecCount ?? 0);
  const aExecRateC = pct(ca?.aExecCount ?? 0, ca?.aSetCount ?? 0);
  const aExecRateP = pct(pa?.aExecCount ?? 0, pa?.aSetCount ?? 0);
  const contractRateC = pct(ca?.contractCount ?? 0, ca?.aExecCount ?? 0);
  const contractRateP = pct(pa?.contractCount ?? 0, pa?.aExecCount ?? 0);

  type Cell = { label: string; curr: number; prev: number; suffix: string; noAgg?: boolean } | null;
  const pairs: [Cell, Cell][] = [
    [{ label: "DM", curr: c.dmCount, prev: p.dmCount, suffix: "件" }, null],
    [
      { label: "B設定", curr: bSetC,              prev: bSetP,              suffix: "件" },
      { label: "B設定率", curr: bSetRateC,        prev: bSetRateP,          suffix: "%" },
    ],
    [
      { label: "B実施", curr: ca?.bExecCount ?? 0, prev: pa?.bExecCount ?? 0, suffix: "件", noAgg: !ca },
      { label: "B実施率", curr: bExecRateC,        prev: bExecRateP,          suffix: "%", noAgg: !ca },
    ],
    [
      { label: "A設定", curr: ca?.aSetCount ?? 0,  prev: pa?.aSetCount ?? 0,  suffix: "件", noAgg: !ca },
      { label: "A設定率", curr: aSetRateC,          prev: aSetRateP,           suffix: "%", noAgg: !ca },
    ],
    [
      { label: "A実施", curr: ca?.aExecCount ?? 0, prev: pa?.aExecCount ?? 0, suffix: "件", noAgg: !ca },
      { label: "A実施率", curr: aExecRateC,         prev: aExecRateP,          suffix: "%", noAgg: !ca },
    ],
    [
      { label: "契約",  curr: ca?.contractCount ?? 0, prev: pa?.contractCount ?? 0, suffix: "件", noAgg: !ca },
      { label: "契約率", curr: contractRateC,         prev: contractRateP,           suffix: "%", noAgg: !ca },
    ],
  ];

  function StatCell({ item }: { item: Cell }) {
    if (!item) return <div />;
    return (
      <div className={`rounded-xl border p-3 space-y-1 ${item.noAgg ? "opacity-40 bg-gray-50" : "bg-white"}`}>
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
    <Card>
      <CardContent className="pt-4">
        {!ca && (
          <p className="text-xs text-amber-600 mb-3">※ B実施以降は「チーム別集計を同期」後に表示されます</p>
        )}
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

// ─── 商談・成約推移グラフ ──────────────────────────────────────────
type MetricKey = "DM数" | "B設定" | "B実施" | "A設定" | "A実施" | "契約"
               | "B設定率" | "B実施率" | "A設定率" | "A実施率" | "契約率";

const COUNT_METRICS: MetricKey[] = ["DM数", "B設定", "B実施", "A設定", "A実施", "契約"];
const RATE_METRICS:  MetricKey[] = ["B設定率", "B実施率", "A設定率", "A実施率", "契約率"];

const METRIC_COLOR: Record<MetricKey, string> = {
  "DM数":   "#6366f1", "B設定":  "#ec4899", "B実施":  "#22c55e",
  "A設定":  "#f97316", "A実施":  "#0ea5e9", "契約":   "#a16207",
  "B設定率": "#f59e0b", "B実施率": "#14b8a6", "A設定率": "#8b5cf6",
  "A実施率": "#e11d48", "契約率":  "#b91c1c",
};

function PipelineChart({ data }: { data: Record<string, number | string>[] }) {
  const [active, setActive] = useState<Set<MetricKey>>(new Set(["DM数", "B設定"]));
  const isRate = (m: MetricKey) => RATE_METRICS.includes(m);

  function toggle(m: MetricKey) {
    setActive((prev) => {
      const next = new Set(prev);
      const mIsRate = isRate(m);
      // 単位グループが違う場合はリセット
      if (mIsRate && [...prev].some((k) => !isRate(k))) {
        return new Set([m]);
      }
      if (!mIsRate && [...prev].some((k) => isRate(k))) {
        return new Set([m]);
      }
      if (next.has(m)) { next.delete(m); if (next.size === 0) next.add(m); }
      else { next.add(m); }
      return next;
    });
  }

  const currentIsRate = [...active].some((k) => isRate(k));
  const unit = currentIsRate ? "%" : "件";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700">商談・成約推移</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* フィルター */}
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">件数</p>
            <div className="flex flex-wrap gap-1.5">
              {COUNT_METRICS.map((m) => {
                const on = active.has(m);
                return (
                  <button key={m} onClick={() => toggle(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                    style={on ? { backgroundColor: METRIC_COLOR[m] } : {}}
                  >{m}</button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">率（件数と同時表示不可）</p>
            <div className="flex flex-wrap gap-1.5">
              {RATE_METRICS.map((m) => {
                const on = active.has(m);
                return (
                  <button key={m} onClick={() => toggle(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                    style={on ? { backgroundColor: METRIC_COLOR[m] } : {}}
                  >{m}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* グラフ */}
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              unit={currentIsRate ? "%" : ""}
              tickFormatter={(v) => {
                if (!currentIsRate && v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                return String(v);
              }}
            />
            <Tooltip
              formatter={(value, name) => [`${Number(value).toLocaleString()}${unit}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {([...active] as MetricKey[]).map((m) => (
              <Line key={m} type="monotone" dataKey={m}
                stroke={METRIC_COLOR[m]} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── 全チームDM推移グラフ ─────────────────────────────────────────

const TEAM_DM_COLORS: Record<string, string> = {
  辻利:    "#6366f1",
  LUMIA:   "#ec4899",
  Covance: "#f59e0b",
};
const ALL_TEAMS = ["辻利", "LUMIA", "Covance"] as const;

function AllTeamsDmChart({
  data,
}: {
  data: { label: string; [team: string]: number | string }[];
}) {
  const [chartType, setChartType] = useState<"line" | "bar">("bar");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">チーム別DM数推移</CardTitle>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(["bar", "line"] as const).map((t) => (
              <button key={t} onClick={() => setChartType(t)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chartType === t ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}>
                {t === "bar" ? "棒" : "折線"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          {chartType === "bar" ? (
            <BarChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip formatter={(value, name) => [`${Number(value).toLocaleString()}件`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {ALL_TEAMS.map((t) => (
                <Bar key={t} dataKey={t} fill={TEAM_DM_COLORS[t]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip formatter={(value, name) => [`${Number(value).toLocaleString()}件`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {ALL_TEAMS.map((t) => (
                <Line key={t} type="monotone" dataKey={t} stroke={TEAM_DM_COLORS[t]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── メインページ ──────────────────────────────────────────────────
export default function SalesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { viewAs } = useViewAs();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated") {
      const role = session?.user?.role;
      const isAdmin = role === "Admin";
      const isViewAsSales = isAdmin && viewAs.role === "Sales";
      if (role !== "Sales" && !isViewAsSales) router.replace("/dashboard");
    }
  }, [status, session, router, viewAs]);

  const loadData = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { loadData(); }, [loadData]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>;
  }

  const { nickname, name, image, role } = session?.user ?? {};
  const team = (role === "Admin" && viewAs.role === "Sales") ? viewAs.team : session?.user?.team;
  const userName = nickname ?? name ?? "営業マン";
  const effectiveRole = (role === "Admin" && viewAs.role === "Sales") ? "Sales" : (role ?? "Sales");

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  // 今月・前月のチーム数値
  const currTeamStats = stats?.current.byTeam.find((b) => b.team === team) ?? null;
  const prevTeamStats = stats?.previous.byTeam.find((b) => b.team === team) ?? null;
  const currTeamAgg   = team ? (stats?.currentTeamAggregates[team] ?? null) : null;
  const prevTeamAgg   = team ? (stats?.previousTeamAggregates[team] ?? null) : null;

  const myDbId = session?.user?.dbId ?? "";

  // 全チームDMグラフデータ
  const allTeamsDmData = (stats?.trend ?? []).map((t) => {
    const row: { label: string; [team: string]: string | number } = { label: t.label };
    for (const tm of ALL_TEAMS) {
      const ta = t.teamAggregates?.[tm];
      const ts = t.byTeam.find((b) => b.team === tm);
      row[tm] = ta?.dmCount ?? ts?.dmCount ?? 0;
    }
    return row;
  });

  // グラフデータ（チーム別、全履歴）
  const chartData = (stats?.trend ?? []).map((t) => {
    const ts = t.byTeam.find((b) => b.team === team) ?? { dmCount: 0, bSetCount: 0, bSetRate: 0 };
    const ta: TeamAgg | null = team ? (t.teamAggregates?.[team] ?? null) : null;
    const bSetC  = ta?.bSetCount ?? ts.bSetCount;
    const bExecC = ta?.bExecCount ?? 0;
    const aSetC  = ta?.aSetCount  ?? 0;
    const aExecC = ta?.aExecCount ?? 0;
    const conC   = ta?.contractCount ?? 0;
    return {
      label: t.label,
      "DM数":    ts.dmCount,
      "B設定":   bSetC,
      "B設定率": pct(bSetC, ts.dmCount),
      "B実施":   bExecC,
      "B実施率": pct(bExecC, bSetC),
      "A設定":   aSetC,
      "A設定率": pct(aSetC, bExecC),
      "A実施":   aExecC,
      "A実施率": pct(aExecC, aSetC),
      "契約":    conC,
      "契約率":  pct(conC, aExecC),
    };
  });

  return (
    <PageLayout title="チーム実績" role={effectiveRole as "Sales"} userName={userName} userImage={image} userTeam={team ?? undefined}>
      <div className="space-y-6">

        {/* アンケート通知 */}
        <SurveyNotice userId={myDbId} />

        {/* 今月の数字（2列ペア） */}
        <div>
          <p className="text-xs text-gray-400 mb-3">{team} · {thisYear}年{thisMonth}月（前月比）</p>
          <StatsPairCard
            curr={currTeamStats}
            prev={prevTeamStats}
            currAgg={currTeamAgg}
            prevAgg={prevTeamAgg}
          />
        </div>

        {/* チーム別DM数推移グラフ */}
        <AllTeamsDmChart data={allTeamsDmData} />

        {/* 商談・成約推移グラフ */}
        <PipelineChart data={chartData} />

      </div>
    </PageLayout>
  );
}
