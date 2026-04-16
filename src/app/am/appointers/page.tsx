"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import RoadmapAppointerRowDB from "@/components/roadmap/RoadmapAppointerRowDB";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from "recharts";
import { ChevronDown, ChevronUp, Award, User } from "lucide-react";
import type { PerformanceRecord } from "@/types/performance";
import type { AppointerRoadmap } from "@/types/roadmap";
import { ROADMAP_STEPS } from "@/types/roadmap";
import type { Role } from "@/types/user";
import { analyzePerformanceAlerts } from "@/types/performance";

// ─── 型定義 ────────────────────────────────────────────────────────
interface DBUser {
  id: string;
  nickname?: string;
  name?: string;
  line_name?: string;
  role: Role;
  team?: string;
  line_picture_url?: string;
  icon_image_url?: string;
  age?: number;
  gender?: string;
  hobbies?: string;
  self_introduction?: string;
}

interface EvalData {
  workload_score: number | null;
  performance_score: number | null;
  dm_count: number | null;
  b_set_rate: number | null;
  discipline_self: number | null;
  absorption_self: number | null;
  contribution_self: number | null;
  thinking_self: number | null;
  discipline_other: number | null;
  absorption_other: number | null;
  contribution_other: number | null;
  thinking_other: number | null;
}

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
    bExecutedCount:  (r.b_executed_count as number | undefined) ?? undefined,
    aSetCount:       (r.a_set_count as number | undefined) ?? undefined,
    aExecutedCount:  (r.a_executed_count as number | undefined) ?? undefined,
    contractCount:   (r.contract_count as number | undefined) ?? undefined,
  };
}

function dbToRoadmap(row: Record<string, unknown>): AppointerRoadmap {
  return {
    userId:             row.user_id as string,
    registeredAt:       row.registered_at as string,
    completedStepCount: row.completed_step_count as number,
    deadlinesByStepId:  (row.deadlines_by_step_id ?? {}) as AppointerRoadmap["deadlinesByStepId"],
    amMemo:             (row.am_memo as string) ?? "",
    salesMemo:          (row.sales_memo as string) ?? "",
  };
}

const SCORE_COLORS: Record<number, string> = {
  5: "bg-green-100 text-green-800",
  4: "bg-blue-100 text-blue-800",
  3: "bg-yellow-100 text-yellow-800",
  2: "bg-orange-100 text-orange-800",
  1: "bg-red-100 text-red-800",
};

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${SCORE_COLORS[score] ?? "bg-gray-100"}`}>
      {score}点
    </span>
  );
}

// ─── アポインター詳細パネル ────────────────────────────────────────
function AppointerDetail({
  user,
  record,
  roadmap,
  onRoadmapUpdated,
}: {
  user: DBUser;
  record: PerformanceRecord | null;
  roadmap: AppointerRoadmap | null;
  onRoadmapUpdated: (r: AppointerRoadmap) => void;
}) {
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [evalLoading, setEvalLoading] = useState(true);
  const [tab, setTab] = useState<"status" | "eval" | "profile">("status");

  useEffect(() => {
    setEvalLoading(true);
    const now = new Date();
    fetch(`/api/evaluation?view=member&userId=${user.id}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setEvalData(d?.result ?? null); setEvalLoading(false); })
      .catch(() => setEvalLoading(false));
  }, [user.id]);

  const radarData = evalData ? [
    { subject: "稼働量",   自己: evalData.workload_score,    他者: evalData.workload_score },
    { subject: "成果",     自己: evalData.performance_score, 他者: evalData.performance_score },
    { subject: "規律",     自己: evalData.discipline_self,   他者: evalData.discipline_other   != null ? +Number(evalData.discipline_other).toFixed(1)   : null },
    { subject: "吸収力",   自己: evalData.absorption_self,   他者: evalData.absorption_other   != null ? +Number(evalData.absorption_other).toFixed(1)   : null },
    { subject: "組織貢献", 自己: evalData.contribution_self, 他者: evalData.contribution_other != null ? +Number(evalData.contribution_other).toFixed(1) : null },
    { subject: "思考力",   自己: evalData.thinking_self,     他者: evalData.thinking_other     != null ? +Number(evalData.thinking_other).toFixed(1)     : null },
  ] : [];

  const TABS = [
    { key: "status",  label: "ステータス" },
    { key: "eval",    label: "人事評価" },
    { key: "profile", label: "プロフィール" },
  ] as const;

  return (
    <div className="border-t bg-gray-50 px-4 pb-4 pt-3 space-y-3">
      {/* タブ */}
      <div className="flex gap-1 bg-gray-200 rounded-lg p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
              tab === t.key ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ステータス */}
      {tab === "status" && (
        <div className="space-y-3">
          {/* デビューまでの段階（ツールチップ付き） */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">デビューまでの段階</p>
            <div className="flex gap-1.5 flex-wrap">
              {ROADMAP_STEPS.map((step, i) => {
                const completed = roadmap ? roadmap.completedStepCount > i : false;
                return (
                  <div key={step.id} className="relative group">
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-default select-none ${
                      completed
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-400 border-gray-200"
                    }`}>
                      STEP {i + 1}
                    </div>
                    {/* ツールチップ */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20 w-44 bg-gray-800 text-white text-xs rounded-lg px-2.5 py-2 text-center pointer-events-none shadow-lg">
                      <p className="font-semibold mb-0.5">STEP {i + 1}</p>
                      <p className="text-gray-300">{step.label}</p>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                    </div>
                  </div>
                );
              })}
              {roadmap && roadmap.completedStepCount >= 6 && (
                <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                  デビュー済み
                </div>
              )}
            </div>
          </div>

          {/* ロードマップ詳細（AM編集） */}
          {roadmap ? (
            <RoadmapAppointerRowDB
              userId={user.id}
              label={user.nickname ?? user.name ?? user.id}
              roadmap={roadmap}
              readOnly={false}
              onUpdated={onRoadmapUpdated}
            />
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">ロードマップ未登録</p>
          )}

          {/* 営業マンのメモ（表示のみ・AMが閲覧可） */}
          {roadmap?.salesMemo && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">営業マンのメモ</p>
              <p className="text-xs text-gray-600 bg-white rounded-lg border p-3 whitespace-pre-wrap">{roadmap.salesMemo}</p>
            </div>
          )}
        </div>
      )}

      {/* 人事評価 */}
      {tab === "eval" && (
        <div className="space-y-3">
          {evalLoading ? (
            <p className="text-xs text-gray-400 text-center py-4">読み込み中...</p>
          ) : !evalData ? (
            <p className="text-xs text-gray-400 text-center py-4">評価結果はまだ公開されていません</p>
          ) : (
            <>
              {/* 定量（稼働量・成果） */}
              {(evalData.workload_score != null || evalData.performance_score != null) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">稼働量</p>
                    {evalData.dm_count != null && <p className="text-xs text-gray-400">DM: {evalData.dm_count.toLocaleString()}通</p>}
                    <ScorePill score={evalData.workload_score} />
                  </div>
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">成果</p>
                    {evalData.b_set_rate != null && <p className="text-xs text-gray-400">B設定率: {Number(evalData.b_set_rate).toFixed(2)}%</p>}
                    <ScorePill score={evalData.performance_score} />
                  </div>
                </div>
              )}
              {/* レーダーチャート */}
              {radarData.length > 0 && (
                <>
                  <p className="text-xs text-gray-400">
                    <span className="text-indigo-500 font-medium">■ 自己</span>
                    　<span className="text-pink-500 font-medium">■ 他者</span>（AM・営業マンの平均）
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} margin={{ top: 5, right: 25, bottom: 5, left: 25 }}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <Radar name="自己" dataKey="自己" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                      <Radar name="他者" dataKey="他者" stroke="#ec4899" fill="#ec4899" fillOpacity={0.2} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="rounded-lg border overflow-hidden bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-medium text-gray-600">項目</th>
                          <th className="text-center px-3 py-1.5 font-medium text-indigo-600">自己</th>
                          <th className="text-center px-3 py-1.5 font-medium text-pink-600">他者</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {radarData.map(({ subject, 自己: s, 他者: o }) => (
                          <tr key={subject}>
                            <td className="px-3 py-1.5 font-medium text-gray-700">{subject}</td>
                            <td className="px-3 py-1.5 text-center text-indigo-600 font-semibold">{s != null ? s : "—"}</td>
                            <td className="px-3 py-1.5 text-center text-pink-600 font-semibold">
                              {o != null ? (Number.isInteger(o) ? o : Number(o).toFixed(1)) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* プロフィール */}
      {tab === "profile" && (
        <div className="space-y-2 text-sm">
          {[
            { label: "年齢",     value: user.age ? `${user.age}歳` : "未設定" },
            { label: "性別",     value: user.gender ?? "未設定" },
            { label: "趣味",     value: user.hobbies?.trim() || "未設定" },
            { label: "自己紹介", value: user.self_introduction?.trim() || "未設定" },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0 pt-0.5">{label}</span>
              <span className="text-xs text-gray-700 flex-1 whitespace-pre-line">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── アポインター行カード ──────────────────────────────────────────
function AppointerRow({
  user,
  record,
  roadmap,
  onRoadmapUpdated,
}: {
  user: DBUser;
  record: PerformanceRecord | null;
  roadmap: AppointerRoadmap | null;
  onRoadmapUpdated: (r: AppointerRoadmap) => void;
}) {
  const [open, setOpen] = useState(false);
  const alerts      = analyzePerformanceAlerts(record ? [record] : []);
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const avatar      = user.icon_image_url ?? user.line_picture_url;
  const displayName = user.nickname ?? user.name ?? user.line_name ?? user.id;

  const dm      = record?.dmCount      ?? 0;
  const bSet    = record?.appoCount    ?? 0;
  const rate    = record?.appointmentRate ?? 0;
  const income  = record?.income       ?? 0;

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      {/* 名前行（タップで展開） */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-indigo-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">{displayName}</span>
            {hasCritical && (
              <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">要対応</span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {/* 今月の数値サマリー */}
      <div className="grid grid-cols-4 divide-x border-t text-center">
        {[
          { label: "DM数", value: dm.toLocaleString(), suffix: "件" },
          { label: "B設定", value: bSet.toString(), suffix: "件" },
          { label: "B設定率", value: rate.toFixed(1), suffix: "%" },
          { label: "見込み収益", value: income > 0 ? `${(income / 10000).toFixed(1)}万` : "—", suffix: "" },
        ].map(({ label, value, suffix }) => (
          <div key={label} className="py-2 px-1">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm font-bold text-gray-800">{value}<span className="text-xs font-normal text-gray-400">{suffix}</span></p>
          </div>
        ))}
      </div>

      {/* 展開パネル */}
      {open && (
        <AppointerDetail
          user={user}
          record={record}
          roadmap={roadmap}
          onRoadmapUpdated={onRoadmapUpdated}
        />
      )}
    </div>
  );
}

// ─── メインページ ──────────────────────────────────────────────────
export default function AppointerManagePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [members, setMembers]     = useState<DBUser[]>([]);
  const [records, setRecords]     = useState<PerformanceRecord[]>([]);
  const [roadmaps, setRoadmaps]   = useState<Record<string, AppointerRoadmap>>({});
  const [loading, setLoading]     = useState(true);

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
      const [membersRes, perfRes] = await Promise.all([
        fetch("/api/user/list?role=Appointer&fields=id,nickname,name,line_name,role,team,line_picture_url,icon_image_url,age,gender,hobbies,self_introduction"),
        fetch(`/api/performance?year=${thisYear}&month=${thisMonth}`),
      ]);

      if (membersRes.ok) {
        const { users } = await membersRes.json();
        setMembers(users ?? []);

        // ロードマップを並行取得
        const rdMap: Record<string, AppointerRoadmap> = {};
        await Promise.all(
          (users as DBUser[]).map(async (u) => {
            const r = await fetch(`/api/roadmap/${u.id}`);
            if (r.ok) {
              const { roadmap } = await r.json();
              if (roadmap) rdMap[u.id] = dbToRoadmap(roadmap);
            }
          })
        );
        setRoadmaps(rdMap);
      }

      if (perfRes.ok) {
        const { records: rows } = await perfRes.json();
        setRecords((rows ?? []).map(toClientRecord));
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

  return (
    <PageLayout title="アポインター管理" role={role ?? "AM"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{thisYear}年{thisMonth}月 — 管轄メンバー（{members.length}名）</p>
          {members.length === 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              教育係未設定のアポインターがいる可能性があります
            </span>
          )}
        </div>

        {members.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400 text-sm space-y-1">
              <Award className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p>管轄アポインターがいません</p>
              <p className="text-xs">管理者画面でアポインターに教育係（AM）を設定してください</p>
            </CardContent>
          </Card>
        ) : (
          members.map((u) => {
            const record = records.find((r) => r.userId === u.id) ?? null;
            const roadmap = roadmaps[u.id] ?? null;
            return (
              <AppointerRow
                key={u.id}
                user={u}
                record={record}
                roadmap={roadmap}
                onRoadmapUpdated={(next) => setRoadmaps((prev) => ({ ...prev, [u.id]: next }))}
              />
            );
          })
        )}
      </div>
    </PageLayout>
  );
}
