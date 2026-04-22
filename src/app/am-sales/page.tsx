"use client";

/**
 * AM_Sales 兼任者 — 数値管理ダッシュボード
 *
 * 上部: Salesページと全く同じ（チーム全体の当月数字 + 商談・成約推移）
 * 下部: 自分管轄のアポインター / 他AM管轄のアポインター（プルダウン）
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TrendingUp as TrendUp, TrendingDown, Minus, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

// ─── 型（Salesページと共通） ─────────────────────────────────────
interface TeamStats { team: string; dmCount: number; bSetCount: number; bSetRate: number; appointerCount: number; }
interface TeamAgg   { dmCount?: number; bSetCount: number; bExecCount: number; aSetCount: number; aExecCount: number; contractCount: number; revenue?: number; }
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

interface AMSalesSection {
  appointerCount: number;
  dmCount: number; bSetCount: number; bSetRate: number;
  bExecCount: number; bExecRate: number;
  aSetCount: number; aSetRate: number;
  aExecCount: number; aExecRate: number;
  contractCount: number; contractRate: number;
  revenue?: number;
}

interface AMSalesResponse {
  curr: { ownAppointers: AMSalesSection; otherAMs: AMSalesSection; };
  prev: { ownAppointers: AMSalesSection; otherAMs: AMSalesSection; };
  otherAMCount: number;
}

// ─── ユーティリティ ─────────────────────────────────────────────────
function round1(n: number) { return Math.round(n * 10) / 10; }
function pct(num: number, den: number) { return den > 0 ? round1(num / den * 100) : 0; }

function Diff({ curr, prev, suffix = "" }: { curr: number; prev: number; suffix?: string }) {
  const diff = curr - prev;
  if (diff === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />前月同</span>;
  if (diff > 0)  return <span className="text-xs text-green-600 flex items-center gap-0.5"><TrendUp className="w-3 h-3" />+{Math.abs(diff).toLocaleString()}{suffix}</span>;
  return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />−{Math.abs(diff).toLocaleString()}{suffix}</span>;
}

// ─── 2列ペアカード（Salesページと同じ） ─────────────────────────────
function StatsPairCard({
  curr, prev, currAgg, prevAgg,
}: {
  curr: TeamStats | null; prev: TeamStats | null;
  currAgg: TeamAgg | null; prevAgg: TeamAgg | null;
}) {
  const c  = curr  ?? { dmCount: 0, bSetCount: 0, bSetRate: 0, appointerCount: 0, team: "" };
  const p  = prev  ?? { dmCount: 0, bSetCount: 0, bSetRate: 0, appointerCount: 0, team: "" };
  const ca = currAgg ?? null;
  const pa = prevAgg ?? null;

  const bSetC = ca?.bSetCount ?? c.bSetCount;
  const bSetP = pa?.bSetCount ?? p.bSetCount;
  const bSetRateC  = pct(bSetC, c.dmCount);
  const bSetRateP  = pct(bSetP, p.dmCount);
  const bExecRateC = pct(ca?.bExecCount ?? 0, bSetC);
  const bExecRateP = pct(pa?.bExecCount ?? 0, bSetP);
  const aSetRateC  = pct(ca?.aSetCount  ?? 0, ca?.bExecCount ?? 0);
  const aSetRateP  = pct(pa?.aSetCount  ?? 0, pa?.bExecCount ?? 0);
  const aExecRateC = pct(ca?.aExecCount ?? 0, ca?.aSetCount  ?? 0);
  const aExecRateP = pct(pa?.aExecCount ?? 0, pa?.aSetCount  ?? 0);
  const contractRateC = pct(ca?.contractCount ?? 0, ca?.aExecCount ?? 0);
  const contractRateP = pct(pa?.contractCount ?? 0, pa?.aExecCount ?? 0);

  type Cell = { label: string; curr: number; prev: number; suffix: string; noAgg?: boolean } | null;
  const pairs: [Cell, Cell][] = [
    [{ label: "DM", curr: c.dmCount, prev: p.dmCount, suffix: "件" }, null],
    [
      { label: "B設定",   curr: bSetC,              prev: bSetP,              suffix: "件" },
      { label: "B設定率", curr: bSetRateC,           prev: bSetRateP,          suffix: "%" },
    ],
    [
      { label: "B実施",   curr: ca?.bExecCount ?? 0, prev: pa?.bExecCount ?? 0, suffix: "件", noAgg: !ca },
      { label: "B実施率", curr: bExecRateC,           prev: bExecRateP,          suffix: "%",  noAgg: !ca },
    ],
    [
      { label: "A設定",   curr: ca?.aSetCount ?? 0,  prev: pa?.aSetCount ?? 0,  suffix: "件", noAgg: !ca },
      { label: "A設定率", curr: aSetRateC,            prev: aSetRateP,           suffix: "%",  noAgg: !ca },
    ],
    [
      { label: "A実施",   curr: ca?.aExecCount ?? 0, prev: pa?.aExecCount ?? 0, suffix: "件", noAgg: !ca },
      { label: "A実施率", curr: aExecRateC,           prev: aExecRateP,          suffix: "%",  noAgg: !ca },
    ],
    [
      { label: "契約",   curr: ca?.contractCount ?? 0, prev: pa?.contractCount ?? 0, suffix: "件", noAgg: !ca },
      { label: "契約率", curr: contractRateC,           prev: contractRateP,           suffix: "%",  noAgg: !ca },
    ],
  ];

  function StatCellInner({ item }: { item: Cell }) {
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
              <StatCellInner item={left} />
              {right ? <StatCellInner item={right} /> : <div />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 商談・成約推移グラフ（Salesページと同じ） ─────────────────────
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
      if (mIsRate && [...prev].some((k) => !isRate(k))) return new Set([m]);
      if (!mIsRate && [...prev].some((k) => isRate(k))) return new Set([m]);
      if (next.has(m)) { next.delete(m); if (next.size === 0) next.add(m); }
      else next.add(m);
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
            <Tooltip formatter={(value, name) => [`${Number(value).toLocaleString()}${unit}`, name]} />
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

// ─── 管轄別プルダウン（ファネル付き） ──────────────────────────────
function SectionDropdown({
  title, subtitle, accentColor, curr, prev, defaultOpen = false,
}: {
  title: string; subtitle?: string; accentColor: string;
  curr: AMSalesSection; prev: AMSalesSection; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  type Cell = { label: string; curr: number; prev: number; suffix: string };
  type Pair = [Cell | null, Cell | null];

  const pairs: Pair[] = [
    [{ label: "DM数",   curr: curr.dmCount,       prev: prev.dmCount,       suffix: "件" }, null],
    [
      { label: "B設定",   curr: curr.bSetCount,    prev: prev.bSetCount,    suffix: "件" },
      { label: "B設定率", curr: curr.bSetRate,     prev: prev.bSetRate,     suffix: "%" },
    ],
    [
      { label: "B実施",   curr: curr.bExecCount,   prev: prev.bExecCount,   suffix: "件" },
      { label: "B実施率", curr: curr.bExecRate,    prev: prev.bExecRate,    suffix: "%" },
    ],
    [
      { label: "A設定",   curr: curr.aSetCount,    prev: prev.aSetCount,    suffix: "件" },
      { label: "A設定率", curr: curr.aSetRate,     prev: prev.aSetRate,     suffix: "%" },
    ],
    [
      { label: "A実施",   curr: curr.aExecCount,   prev: prev.aExecCount,   suffix: "件" },
      { label: "A実施率", curr: curr.aExecRate,    prev: prev.aExecRate,    suffix: "%" },
    ],
    [
      { label: "契約",   curr: curr.contractCount, prev: prev.contractCount, suffix: "件" },
      { label: "契約率", curr: curr.contractRate,  prev: prev.contractRate,  suffix: "%" },
    ],
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2.5 px-4 py-3">
        <div className="w-1 h-6 rounded-full shrink-0" style={{ background: accentColor }} />
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-gray-800">{title}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <span className="text-xs text-gray-400 mr-2 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />{curr.appointerCount}名
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
          {pairs.map(([left, right], i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              {left ? (
                <div className="rounded-xl border bg-white p-3 space-y-1">
                  <p className="text-sm font-semibold text-gray-700">{left.label}</p>
                  <p className="text-xl font-bold leading-none">{left.curr.toLocaleString()}<span className="text-xs font-normal text-gray-400 ml-0.5">{left.suffix}</span></p>
                  <Diff curr={left.curr} prev={left.prev} suffix={left.suffix} />
                </div>
              ) : <div />}
              {right ? (
                <div className="rounded-xl border bg-white p-3 space-y-1">
                  <p className="text-sm font-semibold text-gray-700">{right.label}</p>
                  <p className="text-xl font-bold leading-none">{right.curr.toLocaleString()}<span className="text-xs font-normal text-gray-400 ml-0.5">{right.suffix}</span></p>
                  <Diff curr={right.curr} prev={right.prev} suffix={right.suffix} />
                </div>
              ) : <div />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── メインページ ──────────────────────────────────────────────────
export default function AMSalesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [stats, setStats]         = useState<StatsResponse | null>(null);
  const [amStats, setAmStats]     = useState<AMSalesResponse | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && !["AM_Sales", "Admin"].includes(session.user.role)) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/am-sales/stats"),
      ]);
      if (r1.ok) setStats(await r1.json());
      if (r2.ok) setAmStats(await r2.json());
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const { nickname, name, image, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "";

  if (status === "loading" || loading) {
    return (
      <PageLayout title="数値管理" role="AM_Sales" userName={userName}>
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      </PageLayout>
    );
  }

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const currTeamStats = stats?.current.byTeam.find((b) => b.team === team) ?? null;
  const prevTeamStats = stats?.previous.byTeam.find((b) => b.team === team) ?? null;
  const currTeamAgg   = team ? (stats?.currentTeamAggregates[team]  ?? null) : null;
  const prevTeamAgg   = team ? (stats?.previousTeamAggregates[team] ?? null) : null;

  const chartData = (stats?.trend ?? []).map((t) => {
    const ts    = t.byTeam.find((b) => b.team === team) ?? { dmCount: 0, bSetCount: 0, bSetRate: 0 };
    const ta    = team ? (t.teamAggregates?.[team] ?? null) : null;
    const dmC   = ta?.dmCount   ?? ts.dmCount;
    const bSetC = ta?.bSetCount ?? ts.bSetCount;
    const bExecC = ta?.bExecCount ?? 0;
    const aSetC  = ta?.aSetCount  ?? 0;
    const aExecC = ta?.aExecCount ?? 0;
    const conC   = ta?.contractCount ?? 0;
    return {
      label: t.label,
      "DM数":    dmC,
      "B設定":   bSetC,
      "B設定率": pct(bSetC, dmC),
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
    <PageLayout title="数値管理" role="AM_Sales" userName={userName}>
      <div className="space-y-6">

        {/* ── Salesページと同じ当月数字 ── */}
        <div>
          <p className="text-xs text-gray-400 mb-3">{team} · {thisYear}年{thisMonth}月（前月比）</p>
          <StatsPairCard
            curr={currTeamStats}
            prev={prevTeamStats}
            currAgg={currTeamAgg}
            prevAgg={prevTeamAgg}
          />
        </div>

        {/* ── 商談・成約推移グラフ ── */}
        <PipelineChart data={chartData} />

        {/* ── 自分管轄 / 他AM管轄（プルダウン） ── */}
        {amStats && (
          <div className="space-y-3">
            <SectionDropdown
              title="自分管轄のアポインター"
              subtitle="自分が教育係のアポインター"
              accentColor="#6366f1"
              curr={amStats.curr.ownAppointers}
              prev={amStats.prev.ownAppointers}
              defaultOpen
            />
            <SectionDropdown
              title="他AM管轄のアポインター"
              subtitle={`同チームの他AM ${amStats.otherAMCount}名が管理`}
              accentColor="#64748b"
              curr={amStats.curr.otherAMs}
              prev={amStats.prev.otherAMs}
              defaultOpen={false}
            />
          </div>
        )}

      </div>
    </PageLayout>
  );
}
