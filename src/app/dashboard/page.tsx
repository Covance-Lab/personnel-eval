"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, LogOut } from "lucide-react";
import type { AppointerRoadmap } from "@/types/roadmap";
import type { Role } from "@/types/user";
import type { PerformanceRecord } from "@/types/performance";
import { analyzePerformanceAlerts } from "@/types/performance";
import { ROADMAP_STEPS } from "@/types/roadmap";
import { getRoleLabel } from "@/lib/profilePermissions";
import PerformanceCards from "@/components/performance/PerformanceCards";
import PerformanceAlertBanner from "@/components/performance/PerformanceAlertBanner";
import SyncButton from "@/components/performance/SyncButton";
import RoadmapProgress from "@/components/roadmap/RoadmapProgress";
import RoadmapAppointerRowDB from "@/components/roadmap/RoadmapAppointerRowDB";
import QuestionnaireNoticeDB from "@/components/questionnaire/QuestionnaireNoticeDB";

// 型: DBから取得するユーザー
interface DBUser {
  id: string;
  nickname?: string;
  name?: string;
  role: Role;
  team?: string;
  line_picture_url?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [teamMembers, setTeamMembers]   = useState<DBUser[]>([]);
  const [roadmaps, setRoadmaps]         = useState<Record<string, AppointerRoadmap>>({});
  const [myRecords, setMyRecords]       = useState<PerformanceRecord[]>([]);
  const [teamRecords, setTeamRecords]   = useState<PerformanceRecord[]>([]);
  const [syncKey, setSyncKey]           = useState(0);

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  // ─── 認証チェック ──────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !session.user.setupCompleted) router.replace("/setup");
  }, [status, session, router]);

  // ─── データロード ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.dbId) return;
    const role  = session.user.role;
    const team  = session.user.team;
    const myId  = session.user.dbId;

    // 本人実績
    const perfRes = await fetch(`/api/performance?userId=${myId}`);
    if (perfRes.ok) {
      const { records } = await perfRes.json();
      setMyRecords(toClientRecords(records));
    }

    // AM/Admin/Sales/Bridge/Closer: チームメンバーと今月実績
    if (["Admin", "AM", "Sales", "Bridge", "Closer"].includes(role)) {
      const teamParam = team ? `&team=${encodeURIComponent(team)}` : "";
      const [membersRes, teamPerfRes] = await Promise.all([
        fetch(`/api/user/list?role=Appointer${teamParam}`),
        team
          ? fetch(`/api/performance?team=${encodeURIComponent(team)}&year=${thisYear}&month=${thisMonth}`)
          : Promise.resolve(null),
      ]);

      if (membersRes.ok) {
        const { users } = await membersRes.json();
        setTeamMembers(users ?? []);

        // ロードマップ一括取得
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

      if (teamPerfRes?.ok) {
        const { records } = await teamPerfRes.json();
        setTeamRecords(toClientRecords(records));
      }
    }

    // アポインター本人: 自分のロードマップも取得
    if (role === "Appointer") {
      const r = await fetch(`/api/roadmap/${myId}`);
      if (r.ok) {
        const { roadmap } = await r.json();
        if (roadmap) setRoadmaps({ [myId]: dbToRoadmap(roadmap) });
      }
    }
  }, [status, session, thisYear, thisMonth, syncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  const { role, team, nickname, dbId: myId } = session.user;
  const myCurrentRecord  = myRecords[0] ?? null;
  const myPreviousRecord = myRecords[1] ?? null;
  const myAlerts = analyzePerformanceAlerts(myRecords);

  const isAppointer  = role === "Appointer";
  const isAM         = role === "AM";
  const isAdmin      = role === "Admin";
  const isBridgeCloser = role === "Bridge" || role === "Closer" || role === "Sales";

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ─── ヘッダー ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={nickname ?? ""}
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs text-gray-500">ようこそ</p>
              <div className="flex items-center gap-2">
                <p className="font-bold truncate">{nickname ?? session.user.name}</p>
                <Badge>{getRoleLabel(role)}</Badge>
                {team && <Badge variant="outline">{team}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => router.push("/admin")} className="gap-1.5">
                <Settings className="w-4 h-4" />
                Admin設定
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="gap-1.5 text-gray-500"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </Button>
          </div>
        </div>

        {/* アンケート通知 */}
        <QuestionnaireNoticeDB userId={myId} />

        {/* ─── アポインター ─────────────────────────────────────── */}
        {isAppointer && (
          <>
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-800">
                  今月の実績
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {thisYear}年{thisMonth}月
                  </span>
                </p>
                {team && (
                  <SyncButton
                    team={team as "辻利" | "LUMIA"}
                    onSynced={() => setSyncKey((k) => k + 1)}
                  />
                )}
              </div>
              <PerformanceCards current={myCurrentRecord} previous={myPreviousRecord} />
              {myAlerts.length > 0 && <PerformanceAlertBanner alerts={myAlerts} />}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4">
                {roadmaps[myId] ? (
                  <RoadmapProgress
                    roadmap={roadmaps[myId]}
                    label="デビュー・ロードマップ"
                    showMemo
                    memo={roadmaps[myId].amMemo}
                  />
                ) : (
                  <p className="text-sm text-gray-500">ロードマップを読み込み中...</p>
                )}
              </Card>
              <Card className="p-4">
                <p className="text-sm font-semibold">次のステップ</p>
                {roadmaps[myId] && roadmaps[myId].completedStepCount < ROADMAP_STEPS.length ? (
                  <p className="text-xs text-gray-500 mt-1">
                    現在: ステップ {roadmaps[myId].completedStepCount + 1} /{" "}
                    {ROADMAP_STEPS[roadmaps[myId].completedStepCount]?.label}
                  </p>
                ) : (
                  <p className="text-xs text-green-600 mt-1">デビュー完了 🎉</p>
                )}
              </Card>
            </div>
          </>
        )}

        {/* ─── AM ──────────────────────────────────────────────── */}
        {isAM && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">チーム実績（{team}）</h2>
                  <p className="text-xs text-gray-500">{thisYear}年{thisMonth}月</p>
                </div>
                {team && (
                  <SyncButton
                    team={team as "辻利" | "LUMIA"}
                    onSynced={() => setSyncKey((k) => k + 1)}
                  />
                )}
              </div>
              {teamMembers.map((u) => {
                const rec    = teamRecords.find((r) => r.userId === u.id) ?? null;
                const alerts = analyzePerformanceAlerts(rec ? [rec] : []);
                return (
                  <div key={u.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{u.nickname ?? u.name}</p>
                      {alerts.some((a) => a.severity === "critical") && (
                        <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">要対応</span>
                      )}
                    </div>
                    <PerformanceCards current={rec} />
                    {alerts.length > 0 && <PerformanceAlertBanner alerts={alerts} />}
                  </div>
                );
              })}
            </Card>

            <div className="space-y-3">
              <h2 className="text-lg font-bold">ロードマップ管理</h2>
              {teamMembers.map((u) => {
                const roadmap = roadmaps[u.id];
                if (!roadmap) return null;
                return (
                  <RoadmapAppointerRowDB
                    key={u.id}
                    userId={u.id}
                    label={u.nickname ?? u.name ?? u.id}
                    roadmap={roadmap}
                    readOnly={false}
                    onUpdated={(next) => setRoadmaps((prev) => ({ ...prev, [u.id]: next }))}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Admin ───────────────────────────────────────────── */}
        {isAdmin && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">全チーム実績（今月）</h2>
              {teamMembers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Admin設定でスプシを連携してください。
                </p>
              )}
              {teamMembers.map((u) => {
                const rec    = teamRecords.find((r) => r.userId === u.id) ?? null;
                const alerts = analyzePerformanceAlerts(rec ? [rec] : []);
                return (
                  <div key={u.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{u.nickname ?? u.name}</p>
                      <span className="text-xs text-gray-400">({u.team})</span>
                      {alerts.some((a) => a.severity === "critical") && (
                        <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">要対応</span>
                      )}
                    </div>
                    <PerformanceCards current={rec} />
                    {alerts.length > 0 && <PerformanceAlertBanner alerts={alerts} />}
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {/* ─── Bridge / Closer ─────────────────────────────────── */}
        {isBridgeCloser && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">チーム進捗</h2>
            {teamMembers.map((u) => {
              const roadmap = roadmaps[u.id];
              if (!roadmap) return null;
              return (
                <RoadmapAppointerRowDB
                  key={u.id}
                  userId={u.id}
                  label={u.nickname ?? u.name ?? u.id}
                  roadmap={roadmap}
                  readOnly
                  onUpdated={() => {}}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ヘルパー: DB行 → クライアント型変換 ─────────────────────────

function toClientRecords(rows: Record<string, unknown>[]): PerformanceRecord[] {
  return (rows ?? []).map((r) => ({
    userId:          r.user_id as string,
    sheetName:       r.sheet_name as string ?? "",
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
    amMemo:             row.am_memo as string ?? "",
  };
}
