"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageLayout from "@/components/layout/PageLayout";
import SurveyNotice from "@/components/survey/SurveyNotice";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import type { PerformanceRecord } from "@/types/performance";

// ─── 目標値 ───────────────────────────────────────────────────────
const GOALS = {
  dmCount:   5230,
  bSetCount: 53,
  bSetRate:  1.0, // %
};

function toClientRecords(rows: Record<string, unknown>[]): PerformanceRecord[] {
  return (rows ?? []).map((r) => ({
    userId:          r.user_id as string,
    sheetName:       (r.sheet_name as string) ?? "",
    year:            r.year as number,
    month:           r.month as number,
    dmCount:         r.dm_count as number,
    appoCount:       r.appo_count as number,
    appointmentRate: Number(r.appointment_rate),
    income:          r.income as number,
    team:            r.team as "辻利" | "LUMIA",
    syncedAt:        r.synced_at as string,
    expectedIncome:  r.expected_income as number | undefined,
    bExecutedCount:  (r.b_executed_count as number | undefined) ?? undefined,
    aSetCount:       (r.a_set_count as number | undefined) ?? undefined,
    aExecutedCount:  (r.a_executed_count as number | undefined) ?? undefined,
    contractCount:   (r.contract_count as number | undefined) ?? undefined,
  }));
}

// ─── 達成度ドーナツグラフ ──────────────────────────────────────────
const ACHIEVED_COLOR = "#6366f1";
const REMAINING_COLOR = "#e5e7eb";
const OVER_COLOR = "#22c55e";

interface DonutProps {
  label: string;
  value: number;
  goal: number;
  suffix: string;
  decimals?: number;
}

function DonutChart({ label, value, goal, suffix, decimals = 0 }: DonutProps) {
  const pct     = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over    = value >= goal;
  const display = decimals > 0 ? value.toFixed(decimals) : value.toLocaleString();
  const goalDisplay = decimals > 0 ? goal.toFixed(decimals) : goal.toLocaleString();
  const pctDisplay  = Math.round(pct * 100);

  const data = [
    { name: "達成", value: pct },
    { name: "残り", value: Math.max(1 - pct, 0) },
  ];

  return (
    <div className="bg-white rounded-2xl border p-4 flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <div className="relative w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={58}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={over ? OVER_COLOR : ACHIEVED_COLOR} />
              <Cell fill={REMAINING_COLOR} />
            </Pie>
            <Tooltip
              formatter={(v: unknown, name: unknown) =>
                name === "達成" ? [`${Math.round((v as number) * 100)}%`, "達成率"] : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        {/* 中央テキスト */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`text-xl font-bold ${over ? "text-green-600" : "text-indigo-600"}`}>
            {pctDisplay}<span className="text-sm font-normal">%</span>
          </span>
          <span className="text-xs text-gray-400">達成</span>
        </div>
      </div>
      {/* 数値 */}
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-800">
          {display}<span className="text-sm font-normal text-gray-400 ml-0.5">{suffix}</span>
        </p>
        <p className="text-xs text-gray-400">目標: {goalDisplay}{suffix}</p>
      </div>
    </div>
  );
}

// ─── メインページ ──────────────────────────────────────────────────
export default function AMPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [teamRecords, setTeamRecords]   = useState<PerformanceRecord[]>([]);
  const [allRecords, setAllRecords]     = useState<PerformanceRecord[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !["AM", "Bridge", "Closer"].includes(session?.user?.role ?? "")) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const loadData = useCallback(async () => {
    if (status !== "authenticated") return;
    const myId = session?.user?.dbId;
    if (!myId) { setLoading(false); return; }

    try {
      const [currRes, allRes] = await Promise.all([
        fetch(`/api/performance?year=${thisYear}&month=${thisMonth}`),
        fetch(`/api/performance`),
      ]);
      if (currRes.ok) {
        const { records } = await currRes.json();
        setTeamRecords(toClientRecords(records ?? []));
      }
      if (allRes.ok) {
        const { records } = await allRes.json();
        setAllRecords(toClientRecords(records ?? []));
      }
    } finally {
      setLoading(false);
    }
  }, [status, session, thisYear, thisMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>;
  }

  const { nickname, name, image, role, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "AM";
  const myDbId   = session?.user?.dbId ?? "";

  // 管轄合計（当月）
  const totalDm    = teamRecords.reduce((s, r) => s + (r.dmCount   ?? 0), 0);
  const totalBSet  = teamRecords.reduce((s, r) => s + (r.appoCount ?? 0), 0);
  const bSetRate   = totalDm > 0 ? Math.round((totalBSet / totalDm) * 10000) / 100 : 0;

  // 月次推移データ（全履歴を月ごとに集計）
  type TrendEntry = { dm: number; bSet: number; bExec: number; aSet: number; aExec: number; contract: number; label: string; sortKey: number };
  const trendMap = new Map<string, TrendEntry>();
  for (const r of allRecords) {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    const label = `${r.year}/${r.month}`;
    const ex = trendMap.get(key) ?? { dm: 0, bSet: 0, bExec: 0, aSet: 0, aExec: 0, contract: 0, label, sortKey: r.year * 100 + r.month };
    trendMap.set(key, {
      ...ex,
      dm:       ex.dm       + (r.dmCount          ?? 0),
      bSet:     ex.bSet     + (r.appoCount         ?? 0),
      bExec:    ex.bExec    + (r.bExecutedCount    ?? 0),
      aSet:     ex.aSet     + (r.aSetCount         ?? 0),
      aExec:    ex.aExec    + (r.aExecutedCount    ?? 0),
      contract: ex.contract + (r.contractCount     ?? 0),
    });
  }
  const trendData = Array.from(trendMap.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((v) => ({
      label:  v.label,
      DM数:   v.dm,
      B設定数: v.bSet,
      B設定率: v.dm > 0 ? Math.round((v.bSet / v.dm) * 10000) / 100 : 0,
      B実施:   v.bExec,
      A設定:   v.aSet,
      A実施:   v.aExec,
      契約:    v.contract,
    }));

  // ファネルデータが1件でも存在するか
  const hasFunnelData = trendData.some((d) => d.B実施 > 0 || d.A設定 > 0 || d.A実施 > 0 || d.契約 > 0);

  return (
    <PageLayout title="数値管理" role={role ?? "AM"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {/* アンケート通知 */}
        <SurveyNotice userId={myDbId} />

        {/* 期間ラベル */}
        <p className="text-xs text-gray-400">{thisYear}年{thisMonth}月 — チーム合計</p>

        {/* 達成度グラフ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DonutChart
            label="DM送信数"
            value={totalDm}
            goal={GOALS.dmCount}
            suffix="通"
          />
          <DonutChart
            label="B設定数"
            value={totalBSet}
            goal={GOALS.bSetCount}
            suffix="件"
          />
          <DonutChart
            label="B設定率"
            value={bSetRate}
            goal={GOALS.bSetRate}
            suffix="%"
            decimals={2}
          />
        </div>

        {/* 補足 */}
        <div className="bg-gray-50 rounded-xl border px-4 py-3 text-xs text-gray-500 space-y-0.5">
          <p className="font-semibold text-gray-600">今月の目標値</p>
          <p>DM数: {GOALS.dmCount.toLocaleString()}通　B設定数: {GOALS.bSetCount}件　B設定率: {GOALS.bSetRate}%</p>
        </div>

        {/* 月次推移グラフ① — アポインターチーム実績 */}
        {trendData.length > 0 && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">月次推移 — アポインターチーム</p>

            {/* DM数・B設定数 */}
            <div>
              <p className="text-xs text-gray-400 mb-1">DM数 / B設定数</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="DM数" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="B設定数" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* B設定率 */}
            <div>
              <p className="text-xs text-gray-400 mb-1">B設定率（%）</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} unit="%" />
                  <Tooltip formatter={(v: unknown) => [`${v}%`, "B設定率"]} />
                  <Line type="monotone" dataKey="B設定率" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 月次推移グラフ② — セールスファネル */}
        {hasFunnelData && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">月次推移 — セールスファネル</p>
            <p className="text-xs text-gray-400">B設定 → B実施 → A設定 → A実施 → 契約</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="B設定数" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="B実施"   stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="A設定"   stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="A実施"   stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="契約"    stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </PageLayout>
  );
}
