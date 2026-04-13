"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import RoadmapProgress from "@/components/roadmap/RoadmapProgress";
import SurveyNotice from "@/components/survey/SurveyNotice";
import EvaluationResult from "@/components/evaluation/EvaluationResult";
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

        {/* デビューステータス */}
        <div className={`rounded-2xl p-5 ${debuted ? "bg-green-50 border border-green-200" : "bg-indigo-50 border border-indigo-200"}`}>
          {debuted ? (
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">デビュー済み</p>
              <p className="text-sm text-green-500 mt-1">全ステップ完了おめでとうございます！</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-indigo-700">デビューまでの進捗</p>
                <span className="text-sm font-bold text-indigo-700">{stepCount} / {ROADMAP_STEPS.length}</span>
              </div>
              {/* ステップバー */}
              <div className="flex gap-1.5 mb-3">
                {ROADMAP_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-full ${i < stepCount ? "bg-indigo-500" : "bg-indigo-200"}`}
                  />
                ))}
              </div>
              {currentStep && (
                <p className="text-xs text-indigo-600">
                  現在: <span className="font-semibold">{currentStep.label}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* 今月の数字 */}
        <div>
          <p className="text-xs text-gray-400 mb-2">{thisYear}年{thisMonth}月の実績</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "DM送信数", value: dmCount, suffix: "件" },
              { label: "B設定数", value: bSetCount, suffix: "件" },
              { label: "B設定率", value: bSetRate, suffix: "%" },
            ].map(({ label, value, suffix }) => (
              <div key={label} className="bg-white rounded-xl border p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-bold">{value.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">{suffix}</span></p>
              </div>
            ))}
          </div>
        </div>

        {/* ロードマップ詳細 */}
        {roadmap && (
          <Card>
            <CardContent className="pt-4">
              <RoadmapProgress
                roadmap={roadmap}
                label="デビュー・ロードマップ"
              />
            </CardContent>
          </Card>
        )}

        {/* 人事評価結果（管理者が公開した場合のみ表示） */}
        <EvaluationResult role="Appointer" />

      </div>
    </PageLayout>
  );
}
