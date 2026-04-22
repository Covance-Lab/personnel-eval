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

        {/* デビューステータス — 一番上 */}
        <div className={`rounded-2xl p-5 ${debuted ? "bg-green-50 border border-green-200" : "bg-indigo-50 border border-indigo-200"}`}>
          {debuted ? (
            <div className="text-center">
              <p className="text-4xl font-bold text-green-700 mb-1">100%</p>
              <p className="text-sm font-semibold text-green-700">デビュー済み</p>
              <p className="text-xs text-green-500 mt-1">全ステップ完了おめでとうございます！</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold text-indigo-700">デビューまでの進捗</p>
                <span className="text-2xl font-bold text-indigo-700">{Math.round((stepCount / ROADMAP_STEPS.length) * 100)}%</span>
              </div>
              {/* プログレスバー */}
              <div className="w-full bg-indigo-200 rounded-full h-3 mb-2">
                <div
                  className="bg-indigo-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.round((stepCount / ROADMAP_STEPS.length) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-indigo-600">
                  {stepCount} / {ROADMAP_STEPS.length} ステップ完了
                </p>
                {currentStep && (
                  <p className="text-xs text-indigo-600">
                    現在: <span className="font-semibold">{currentStep.label}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 今月の数字 + 達成率 */}
        {(() => {
          const DM_TARGET   = 625;
          const SET_TARGET  = 7;
          const RATE_TARGET = 1.0;
          const dmAchieve   = DM_TARGET   > 0 ? Math.round((dmCount   / DM_TARGET)   * 100) : 0;
          const setAchieve  = SET_TARGET  > 0 ? Math.round((bSetCount / SET_TARGET)  * 100) : 0;
          const rateAchieve = RATE_TARGET > 0 ? Math.round((bSetRate  / RATE_TARGET) * 100) : 0;

          const cols = [
            { label: "DM数",   value: dmCount,   suffix: "件", target: DM_TARGET,   achieve: dmAchieve,   unit: "件" },
            { label: "B設定数", value: bSetCount, suffix: "件", target: SET_TARGET,  achieve: setAchieve,  unit: "件" },
            { label: "B設定率", value: bSetRate,  suffix: "%",  target: RATE_TARGET, achieve: rateAchieve, unit: "%" },
          ];

          return (
            <div>
              <p className="text-xs text-gray-400 mb-2">{thisYear}年{thisMonth}月の実績</p>
              <div className="space-y-2">
                {cols.map(({ label, value, suffix, target, achieve }) => (
                  <div key={label} className="bg-white rounded-xl border px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-gray-500">{label}</p>
                      <div className="text-right">
                        <span className="text-lg font-bold">{value.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-0.5">{suffix}</span>
                        <span className="text-xs text-gray-400 ml-2">/ 目標 {target}{suffix}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                      <div
                        className={`h-1.5 rounded-full transition-all ${achieve >= 100 ? "bg-green-500" : achieve >= 70 ? "bg-amber-400" : "bg-indigo-400"}`}
                        style={{ width: `${Math.min(achieve, 100)}%` }}
                      />
                    </div>
                    <p className={`text-xs font-semibold text-right ${achieve >= 100 ? "text-green-600" : achieve >= 70 ? "text-amber-600" : "text-indigo-600"}`}>
                      達成率 {achieve}%
                    </p>
                  </div>
                ))}
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
