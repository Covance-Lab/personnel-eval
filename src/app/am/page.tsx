"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageLayout from "@/components/layout/PageLayout";
import SurveyNotice from "@/components/survey/SurveyNotice";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
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

  const [teamRecords, setTeamRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading]         = useState(true);

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
      const res = await fetch(`/api/performance?year=${thisYear}&month=${thisMonth}`);
      if (res.ok) {
        const { records } = await res.json();
        setTeamRecords(toClientRecords(records ?? []));
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

  // 管轄合計
  const totalDm    = teamRecords.reduce((s, r) => s + (r.dmCount   ?? 0), 0);
  const totalBSet  = teamRecords.reduce((s, r) => s + (r.appoCount ?? 0), 0);
  const bSetRate   = totalDm > 0 ? Math.round((totalBSet / totalDm) * 10000) / 100 : 0;

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

      </div>
    </PageLayout>
  );
}
