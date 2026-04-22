"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import RoadmapAppointerRowDB from "@/components/roadmap/RoadmapAppointerRowDB";
import SurveyNotice from "@/components/survey/SurveyNotice";
import EvaluationResult from "@/components/evaluation/EvaluationResult";
import { Calendar } from "lucide-react";
import AccountsEditor from "@/components/accounts/AccountsEditor";
import { ROADMAP_STEPS } from "@/types/roadmap";

// ─── ドーナツチャート ──────────────────────────────────────────────
function DonutChart({ achieve, label, value, target, suffix, color }: {
  achieve: number; label: string; value: number | string; target: number | string; suffix: string; color: string;
}) {
  const pct = Math.min(achieve, 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <div className="relative">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="48" cy="48" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none" style={{ color }}>{achieve}%</span>
          <span className="text-[10px] text-gray-400">達成</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-800 leading-none">{typeof value === "number" ? value.toLocaleString() : value}<span className="text-sm font-normal text-gray-400 ml-0.5">{suffix}</span></p>
        <p className="text-xs text-gray-400 mt-1">目標: {typeof target === "number" ? target.toLocaleString() : target}{suffix}</p>
      </div>
    </div>
  );
}
import type { AppointerRoadmap } from "@/types/roadmap";
import type { PerformanceRecord } from "@/types/performance";

function toClientRecord(r: Record<string, unknown>): PerformanceRecord {
  return {
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
  };
}

export default function AppointerPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [roadmap, setRoadmap]   = useState<AppointerRoadmap | null>(null);
  const [thisMonthRec, setThisMonthRec] = useState<PerformanceRecord | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session?.user?.role !== "Appointer") router.replace("/dashboard");
  }, [status, session, router]);

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const loadData = useCallback(async () => {
    if (status !== "authenticated") return;
    const myId = session?.user?.dbId;
    if (!myId) { setLoading(false); return; }

    try {
      // スプレッドシートから最新実績を自動取得（見つからなければ0、エラー時は無視）
      fetch("/api/sheets/auto-sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: thisYear, month: thisMonth }),
      }).catch(() => {});

      const [rdRes, perfRes] = await Promise.all([
        fetch(`/api/roadmap/${myId}`),
        fetch(`/api/performance?userId=${myId}`),
      ]);

      if (rdRes.ok) {
        const { roadmap: rd } = await rdRes.json();
        if (rd) {
          setRoadmap({
            userId:             rd.user_id,
            registeredAt:       rd.registered_at,
            completedStepCount: rd.completed_step_count,
            deadlinesByStepId:  rd.deadlines_by_step_id ?? {},
            amMemo:             rd.am_memo ?? "",
          });
        }
      }

      if (perfRes.ok) {
        const { records } = await perfRes.json();
        const rows: PerformanceRecord[] = (records ?? []).map(toClientRecord);
        const curr = rows.find((r) => r.year === thisYear && r.month === thisMonth) ?? rows[0] ?? null;
        setThisMonthRec(curr);
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
  const userName = nickname ?? name ?? "アポインター";

  const stepCount   = roadmap?.completedStepCount ?? 0;
  const debuted     = stepCount >= ROADMAP_STEPS.length;
  const currentStep = ROADMAP_STEPS[stepCount];

  const dmCount  = thisMonthRec?.dmCount  ?? 0;
  const bSetCount = thisMonthRec?.appoCount ?? 0;
  const bSetRate  = dmCount > 0 ? Math.round((bSetCount / dmCount) * 1000) / 10 : 0;

  const myDbId = session?.user?.dbId ?? "";

  return (
    <PageLayout title="現状の数字" role={role ?? "Appointer"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-5">

        {/* アンケート通知 */}
        <SurveyNotice userId={myDbId} />

        {/* 当月実績 — ドーナツチャート3列 */}
        {(() => {
          const DM_TARGET   = 625;
          const SET_TARGET  = 7;
          const RATE_TARGET = 1.0;
          const dmAchieve   = DM_TARGET   > 0 ? Math.round((dmCount   / DM_TARGET)   * 100) : 0;
          const setAchieve  = SET_TARGET  > 0 ? Math.round((bSetCount / SET_TARGET)  * 100) : 0;
          const rateAchieve = RATE_TARGET > 0 ? Math.round((bSetRate  / RATE_TARGET) * 100) : 0;
          const color = (pct: number) => pct >= 100 ? "#22c55e" : pct >= 70 ? "#f59e0b" : "#6366f1";

          return (
            <div>
              <p className="text-xs text-gray-400 mb-3">{thisYear}年{thisMonth}月 — チーム合計</p>
              <div className="grid grid-cols-3 gap-2">
                <DonutChart achieve={dmAchieve}   label="DM送信数" value={dmCount}   target={DM_TARGET}   suffix="通" color={color(dmAchieve)} />
                <DonutChart achieve={setAchieve}  label="B設定数"  value={bSetCount}  target={SET_TARGET}  suffix="件" color={color(setAchieve)} />
                <DonutChart achieve={rateAchieve} label="B設定率"  value={bSetRate.toFixed(2)} target="1.00" suffix="%" color={color(rateAchieve)} />
              </div>
            </div>
          );
        })()}

        {/* アカウント設定 */}
        <AccountsEditor userId={myDbId} />

        {/* ロードマップ詳細（インタラクティブ） */}
        {roadmap && (
          <div className="space-y-2">
            {roadmap.registeredAt && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 px-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>業務スタート日：{roadmap.registeredAt.slice(0, 10)}</span>
              </div>
            )}
            <RoadmapAppointerRowDB
              userId={myDbId}
              label="デビュー・ロードマップ"
              roadmap={roadmap}
              readOnly={false}
              showAmMemo={false}
              onUpdated={(next) => setRoadmap(next)}
            />
          </div>
        )}

        {/* 人事評価結果（管理者が公開した場合のみ表示） */}
        <EvaluationResult />

      </div>
    </PageLayout>
  );
}
