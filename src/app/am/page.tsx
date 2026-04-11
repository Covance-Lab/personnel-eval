"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import SurveyNotice from "@/components/survey/SurveyNotice";
import EvaluationResult from "@/components/evaluation/EvaluationResult";
import TeamEvaluationList from "@/components/evaluation/TeamEvaluationList";
import RoadmapAppointerRowDB from "@/components/roadmap/RoadmapAppointerRowDB";
import type { AppointerRoadmap } from "@/types/roadmap";
import type { Role } from "@/types/user";
import type { PerformanceRecord } from "@/types/performance";
import { analyzePerformanceAlerts } from "@/types/performance";
import PerformanceCards from "@/components/performance/PerformanceCards";
import PerformanceAlertBanner from "@/components/performance/PerformanceAlertBanner";

interface DBUser {
  id: string;
  nickname?: string;
  name?: string;
  role: Role;
  team?: string;
  line_picture_url?: string;
  icon_image_url?: string;
}

function Diff({ curr, prev, suffix = "" }: { curr: number; prev: number; suffix?: string }) {
  const diff = curr - prev;
  if (diff === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />前月同</span>;
  if (diff > 0) return <span className="text-xs text-green-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{diff.toLocaleString()}{suffix}</span>;
  return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{diff.toLocaleString()}{suffix}</span>;
}

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

function dbToRoadmap(row: Record<string, unknown>): AppointerRoadmap {
  return {
    userId:             row.user_id as string,
    registeredAt:       row.registered_at as string,
    completedStepCount: row.completed_step_count as number,
    deadlinesByStepId:  (row.deadlines_by_step_id ?? {}) as AppointerRoadmap["deadlinesByStepId"],
    amMemo:             (row.am_memo as string) ?? "",
  };
}

export default function AMPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [members, setMembers]     = useState<DBUser[]>([]);
  const [roadmaps, setRoadmaps]   = useState<Record<string, AppointerRoadmap>>({});
  const [teamRecords, setTeamRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !["AM", "Bridge", "Closer"].includes(session?.user?.role ?? "")) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const loadData = useCallback(async () => {
    if (status !== "authenticated") return;
    const myId = session?.user?.dbId;
    const team = session?.user?.team;
    if (!myId) { setLoading(false); return; }

    try {
      // AM権限: APIサーバー側で education_mentor_user_id によって自動フィルタされる
      // teamパラメータは渡さない（チーム全員ではなく自分の管轄のみ取得）
      const [membersRes, teamPerfRes] = await Promise.all([
        fetch(`/api/user/list?role=Appointer`),
        fetch(`/api/performance?year=${thisYear}&month=${thisMonth}`),
      ]);

      if (membersRes.ok) {
        const { users } = await membersRes.json();
        setMembers(users ?? []);

        const rdMaps: Record<string, AppointerRoadmap> = {};
        await Promise.all(
          (users as DBUser[]).map(async (u) => {
            const r = await fetch(`/api/roadmap/${u.id}`);
            if (r.ok) {
              const { roadmap } = await r.json();
              if (roadmap) rdMaps[u.id] = dbToRoadmap(roadmap);
            }
          })
        );
        setRoadmaps(rdMaps);
      }

      if (teamPerfRes.ok) {
        const { records } = await teamPerfRes.json();
        setTeamRecords(toClientRecords(records));
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

  // 管轄合計
  const totalDm    = teamRecords.reduce((s, r) => s + (r.dmCount ?? 0), 0);
  const totalBSet  = teamRecords.reduce((s, r) => s + (r.appoCount ?? 0), 0);
  const bSetRate   = totalDm > 0 ? Math.round((totalBSet / totalDm) * 1000) / 10 : 0;

  const myDbId = session?.user?.dbId ?? "";

  return (
    <PageLayout title="管轄メンバー実績" role={role ?? "AM"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {/* アンケート通知 */}
        <SurveyNotice userId={myDbId} />

        {/* 管轄合計 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "管轄DM数合計", value: totalDm, suffix: "件" },
            { label: "B設定数合計", value: totalBSet, suffix: "件" },
            { label: "B設定率",    value: bSetRate, suffix: "%" },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="bg-white rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-2xl font-bold">{value.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">{suffix}</span></p>
            </div>
          ))}
        </div>

        {/* メンバー別実績 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">{thisYear}年{thisMonth}月 — メンバー別</p>
          {members.length === 0 && (
            <Card><CardContent className="py-8 text-center text-gray-400 text-sm">管轄アポインターがいません</CardContent></Card>
          )}
          {members.map((u) => {
            const rec    = teamRecords.find((r) => r.userId === u.id) ?? null;
            const alerts = analyzePerformanceAlerts(rec ? [rec] : []);
            const avatar = u.icon_image_url ?? u.line_picture_url;
            const displayName = u.nickname ?? u.name ?? u.id;
            return (
              <div key={u.id} className="bg-white rounded-xl border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                      <span className="text-xs text-gray-500">{displayName.charAt(0)}</span>
                    </div>
                  )}
                  <span className="text-sm font-medium">{displayName}</span>
                  {alerts.some((a) => a.severity === "critical") && (
                    <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">要対応</span>
                  )}
                </div>
                <PerformanceCards current={rec} />
                {alerts.length > 0 && <PerformanceAlertBanner alerts={alerts} />}
              </div>
            );
          })}
        </div>

        {/* ロードマップ管理 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">ロードマップ管理</p>
          {members.map((u) => {
            const roadmap = roadmaps[u.id];
            if (!roadmap) return null;
            const displayName = u.nickname ?? u.name ?? u.id;
            return (
              <RoadmapAppointerRowDB
                key={u.id}
                userId={u.id}
                label={displayName}
                roadmap={roadmap}
                readOnly={false}
                onUpdated={(next) => setRoadmaps((prev) => ({ ...prev, [u.id]: next }))}
              />
            );
          })}
        </div>

        {/* 自分の人事評価結果（管理者が公開した場合のみ表示） */}
        <EvaluationResult role="AM" />

        {/* 管轄アポインター + 自分の評価一覧（公開済みのみ） */}
        <TeamEvaluationList title="管轄メンバー 人事評価結果" />

      </div>
    </PageLayout>
  );
}
