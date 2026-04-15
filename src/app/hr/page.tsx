"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserCheck, UserX, TrendingUp,
  ChevronDown, ChevronUp,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Legend,
} from "recharts";

interface UserRecord {
  id: string;
  nickname?: string;
  name?: string;
  role: string;
  team?: string;
  line_picture_url?: string;
  icon_image_url?: string;
  created_at?: string;
  completedStepCount: number;
  debuted: boolean;
  isChurned: boolean;
  dmCount: number;
  bSetCount: number;
  bSetRate: number | null;
  amMemo: string;
  amName: string | null;
  education_mentor_user_id?: string | null;
  age?: number;
  gender?: string;
  hobbies?: string;
  self_introduction?: string;
}

interface PreDebutStep {
  step: number;
  count: number;
}

interface Summary {
  total: number;
  debuted: number;
  churned: number;
  preDebut: PreDebutStep[];
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

const TEAM_COLORS: Record<string, string> = {
  辻利: "#6366f1",
  LUMIA: "#ec4899",
  Covance: "#f59e0b",
};

const STEP_LABELS = ["未着手", "STEP 1", "STEP 2", "STEP 3", "STEP 4", "STEP 5"];

// ────────────────────────────────────────────
// レーダーチャート（共通）
// ────────────────────────────────────────────
function EvalPanel({ userId }: { userId: string }) {
  const [eval_, setEval] = useState<EvalData | null | "loading">("loading");

  useEffect(() => {
    const now = new Date();
    fetch(`/api/evaluation?view=member&userId=${userId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setEval(d?.result ?? null))
      .catch(() => setEval(null));
  }, [userId]);

  if (eval_ === "loading") return <p className="text-xs text-gray-400 text-center py-4">読み込み中...</p>;
  if (!eval_) return <p className="text-xs text-gray-400 text-center py-4">評価結果が公開されていません</p>;

  const radarData = [
    { subject: "稼働量",   自己: eval_.workload_score    ?? 0, 他者: eval_.workload_score    ?? 0 },
    { subject: "成果",     自己: eval_.performance_score ?? 0, 他者: eval_.performance_score ?? 0 },
    { subject: "規律",    自己: eval_.discipline_self   ?? 0, 他者: eval_.discipline_other   != null ? +Number(eval_.discipline_other).toFixed(1)   : 0 },
    { subject: "吸収力",  自己: eval_.absorption_self   ?? 0, 他者: eval_.absorption_other   != null ? +Number(eval_.absorption_other).toFixed(1)   : 0 },
    { subject: "組織貢献", 自己: eval_.contribution_self ?? 0, 他者: eval_.contribution_other != null ? +Number(eval_.contribution_other).toFixed(1) : 0 },
    { subject: "思考力",  自己: eval_.thinking_self     ?? 0, 他者: eval_.thinking_other     != null ? +Number(eval_.thinking_other).toFixed(1)     : 0 },
  ];

  return (
    <div className="space-y-3">
      {(eval_.workload_score != null || eval_.performance_score != null) && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "稼働量", score: eval_.workload_score, sub: eval_.dm_count != null ? `DM: ${eval_.dm_count}通` : undefined },
            { label: "成果",   score: eval_.performance_score, sub: eval_.b_set_rate != null ? `B設定率: ${Number(eval_.b_set_rate).toFixed(2)}%` : undefined },
          ].map(({ label, score, sub }) => score != null && (
            <div key={label} className="bg-white rounded-lg border p-2 text-center">
              <p className="text-xs text-gray-500">{label}</p>
              {sub && <p className="text-xs text-gray-400">{sub}</p>}
              <p className="text-xl font-bold text-indigo-600">{score}<span className="text-xs text-gray-400 ml-0.5">点</span></p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400">
        <span className="text-indigo-500 font-medium">■ 自己</span>
        　<span className="text-pink-500 font-medium">■ 他者</span>
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={radarData} margin={{ top: 5, right: 25, bottom: 5, left: 25 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
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
            {[
              { label: "規律",    s: eval_.discipline_self,   o: eval_.discipline_other },
              { label: "吸収力",  s: eval_.absorption_self,   o: eval_.absorption_other },
              { label: "組織貢献", s: eval_.contribution_self, o: eval_.contribution_other },
              { label: "思考力",  s: eval_.thinking_self,     o: eval_.thinking_other },
            ].map(({ label, s, o }) => (
              <tr key={label}>
                <td className="px-3 py-1.5 font-medium text-gray-700">{label}</td>
                <td className="px-3 py-1.5 text-center text-indigo-600 font-semibold">{s ?? "—"}</td>
                <td className="px-3 py-1.5 text-center text-pink-600 font-semibold">{o != null ? Number(o).toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// タブ付き展開行（アポインター用）
// ────────────────────────────────────────────
function AppointerExpandRow({ user: u }: { user: UserRecord }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"status" | "eval" | "profile">("status");

  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;
  const bSetRateStr = u.bSetRate != null ? `${Number(u.bSetRate).toFixed(2)}%` : "—";

  const TABS = [
    { key: "status" as const,  label: "ステータス" },
    { key: "eval"   as const,  label: "人事評価" },
    { key: "profile" as const, label: "プロフィール" },
  ];

  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <span className="text-xs text-gray-500">{displayName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{displayName}</span>
            <StatusBadge user={u} />
          </div>
          {!u.debuted && (
            <p className="text-xs text-gray-400 mt-0.5">
              {STEP_LABELS[u.completedStepCount] ?? `STEP ${u.completedStepCount}`} 完了
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 text-right">
          <div>
            <p className="text-xs text-gray-400">DM数</p>
            <p className="text-sm font-bold">{u.dmCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">B設定</p>
            <p className="text-sm font-bold">{u.bSetCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">B設定率</p>
            <p className="text-sm font-bold">{bSetRateStr}</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />}
        </div>
      </button>

      {open && (
        <div className="bg-gray-50 px-4 pb-4 pt-3 border-t space-y-3">
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
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">デビューまでの段階</p>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 6 }, (_, i) => i + 1).map((step) => (
                    <div
                      key={step}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        u.debuted || u.completedStepCount >= step
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-400 border-gray-200"
                      }`}
                    >
                      STEP {step}
                    </div>
                  ))}
                  {u.debuted && (
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                      デビュー済み
                    </div>
                  )}
                </div>
              </div>
              {u.amMemo ? (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">AMのメモ</p>
                  <p className="text-xs text-gray-600 bg-white rounded-lg border p-3 whitespace-pre-wrap">{u.amMemo}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">AMのメモはありません</p>
              )}
            </div>
          )}

          {/* 人事評価 */}
          {tab === "eval" && <EvalPanel userId={u.id} />}

          {/* プロフィール */}
          {tab === "profile" && (
            <div className="bg-white rounded-lg border p-3 space-y-1.5 text-xs">
              {[
                { label: "チーム",    value: u.team ?? "—" },
                { label: "担当AM",   value: u.amName ?? "—" },
                { label: "登録日",    value: u.created_at ? new Date(u.created_at).toLocaleDateString("ja-JP") : "—" },
                { label: "ステータス", value: null },
              ].map(({ label, value }) => value !== null ? (
                <div key={label} className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">{label}</span>
                  <span className="text-gray-700">{value}</span>
                </div>
              ) : (
                <div key={label} className="flex gap-2 items-center">
                  <span className="text-gray-400 w-20 shrink-0">{label}</span>
                  <StatusBadge user={u} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// タブ付き展開行（AM用）
// ────────────────────────────────────────────
function AMExpandRow({ user: u }: { user: UserRecord }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"status" | "eval" | "profile">("status");

  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;

  const TABS = [
    { key: "status" as const,  label: "ステータス" },
    { key: "eval"   as const,  label: "人事評価" },
    { key: "profile" as const, label: "プロフィール" },
  ];

  // AMのステップは仮で7ステップ表示
  const AM_TOTAL_STEPS = 7;

  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <span className="text-xs text-gray-500">{displayName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{displayName}</span>
            <Badge variant="outline" className="text-xs">AM</Badge>
          </div>
          {u.team && <p className="text-xs text-gray-400 mt-0.5">{u.team}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />}
      </button>

      {open && (
        <div className="bg-gray-50 px-4 pb-4 pt-3 border-t space-y-3">
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
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">ステップ進捗</p>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: AM_TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
                    <div
                      key={step}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        u.completedStepCount >= step
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-400 border-gray-200"
                      }`}
                    >
                      STEP {step}
                    </div>
                  ))}
                </div>
              </div>
              {u.amMemo ? (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">メモ</p>
                  <p className="text-xs text-gray-600 bg-white rounded-lg border p-3 whitespace-pre-wrap">{u.amMemo}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">メモはありません</p>
              )}
            </div>
          )}

          {/* 人事評価 */}
          {tab === "eval" && <EvalPanel userId={u.id} />}

          {/* プロフィール */}
          {tab === "profile" && (
            <div className="bg-white rounded-lg border p-3 space-y-1.5 text-xs">
              {[
                { label: "チーム", value: u.team ?? "—" },
                { label: "登録日", value: u.created_at ? new Date(u.created_at).toLocaleDateString("ja-JP") : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">{label}</span>
                  <span className="text-gray-700">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Admin/AM用シンプル行
// ────────────────────────────────────────────
function UserRow({ user: u }: { user: UserRecord }) {
  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <span className="text-xs text-gray-500">{displayName.charAt(0)}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{displayName}</span>
          {u.team && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${TEAM_COLORS[u.team] ?? "#94a3b8"}20`,
                color: TEAM_COLORS[u.team] ?? "#64748b",
              }}
            >
              {u.team}
            </span>
          )}
          <StatusBadge user={u} />
        </div>
        {u.role === "Appointer" && !u.debuted && (
          <p className="text-xs text-gray-400 mt-0.5">
            {STEP_LABELS[u.completedStepCount] ?? `STEP ${u.completedStepCount}`} 完了
          </p>
        )}
      </div>
      {u.role === "Appointer" && (
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">DM / B設定</p>
          <p className="text-sm font-bold">
            {u.dmCount.toLocaleString()} / {u.bSetCount.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ user: u }: { user: UserRecord }) {
  if (u.role === "AM") return <Badge variant="outline" className="text-xs">AM</Badge>;
  if (u.isChurned) return <Badge className="bg-red-100 text-red-700 text-xs border-0">離脱</Badge>;
  if (u.debuted) return <Badge className="bg-green-100 text-green-700 text-xs border-0">デビュー済み</Badge>;
  return <Badge className="bg-indigo-100 text-indigo-700 text-xs border-0">デビュー前</Badge>;
}

// ────────────────────────────────────────────
// メインページ
// ────────────────────────────────────────────
export default function HRPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTeam, setFilterTeam] = useState<string>("全体");
  const [filterStatus, setFilterStatus] = useState<string>("全員");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!["Admin", "AM", "Sales"].includes(session?.user?.role ?? "")) {
      router.replace("/dashboard");
      return;
    }
    fetch("/api/hr")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users ?? []);
        setSummary(d.summary ?? null);
      })
      .finally(() => setLoading(false));
  }, [status, session, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  const { nickname, name, image, role, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "ユーザー";
  const isSales = role === "Sales";

  // ── Sales専用ビュー ────────────────────────────────
  if (isSales) {
    const appointers = users.filter((u) => u.role === "Appointer");
    const ams        = users.filter((u) => u.role === "AM");

    return (
      <PageLayout title="アポインター管理" role={role ?? "Sales"} userName={userName} userImage={image} userTeam={team}>
        <div className="space-y-6">

          {/* サマリーカード */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-500">アポインター総数</p>
                  </div>
                  <p className="text-3xl font-bold">{summary.total}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <UserCheck className="w-4 h-4 text-green-500" />
                    <p className="text-xs text-gray-500">デビュー済み</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{summary.debuted}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs text-gray-500">デビュー前</p>
                  </div>
                  <p className="text-3xl font-bold text-indigo-600">
                    {summary.preDebut.reduce((s, p) => s + p.count, 0)}
                    <span className="text-base font-normal text-gray-500 ml-1">人</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <UserX className="w-4 h-4 text-red-400" />
                    <p className="text-xs text-gray-500">当月離脱</p>
                  </div>
                  <p className="text-3xl font-bold text-red-500">{summary.churned}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* デビュー前ステップ内訳 */}
          {summary && summary.preDebut.some((p) => p.count > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">デビュー前 — ステップ別人数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {summary.preDebut.filter((p) => p.count > 0).map(({ step, count }) => (
                    <div key={step} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border">
                      <span className="text-xs font-medium text-gray-500">{STEP_LABELS[step] ?? `STEP ${step}`}</span>
                      <span className="text-lg font-bold text-indigo-600">{count}</span>
                      <span className="text-xs text-gray-400">人</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* アポインター一覧 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">
                アポインター一覧 <span className="font-normal text-gray-400 ml-1">({appointers.length}人)</span>
              </CardTitle>
              <p className="text-xs text-gray-400">名前をタップすると詳細が展開されます</p>
            </CardHeader>
            <CardContent className="p-0">
              {appointers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">アポインターがいません</p>
              ) : (
                <div>
                  {appointers.map((u) => (
                    <AppointerExpandRow key={u.id} user={u} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* アポインターマネージャー一覧 */}
          {ams.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  アポインターマネージャー一覧 <span className="font-normal text-gray-400 ml-1">({ams.length}人)</span>
                </CardTitle>
                <p className="text-xs text-gray-400">名前をタップすると詳細が展開されます</p>
              </CardHeader>
              <CardContent className="p-0">
                <div>
                  {ams.map((u) => (
                    <AMExpandRow key={u.id} user={u} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </PageLayout>
    );
  }

  // ── Admin / AM ビュー ────────────────────────────────
  const teams = ["全体", ...Array.from(new Set(users.map((u) => u.team).filter(Boolean))) as string[]];

  const filtered = users.filter((u) => {
    if (filterTeam !== "全体" && u.team !== filterTeam) return false;
    if (filterStatus === "デビュー済み") return u.debuted && !u.isChurned;
    if (filterStatus === "デビュー前") return !u.debuted;
    if (filterStatus === "離脱") return u.isChurned;
    return true;
  });

  const appointers = filtered.filter((u) => u.role === "Appointer");
  const ams = filtered.filter((u) => u.role === "AM");

  return (
    <PageLayout title="人事評価" role={role ?? "Admin"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {/* サマリーカード */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-500">アポインター総数</p>
                </div>
                <p className="text-3xl font-bold">{summary.total}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="w-4 h-4 text-green-500" />
                  <p className="text-xs text-gray-500">デビュー済み</p>
                </div>
                <p className="text-3xl font-bold text-green-600">{summary.debuted}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <p className="text-xs text-gray-500">デビュー前</p>
                </div>
                <p className="text-3xl font-bold text-indigo-600">
                  {summary.preDebut.reduce((s, p) => s + p.count, 0)}
                  <span className="text-base font-normal text-gray-500 ml-1">人</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserX className="w-4 h-4 text-red-400" />
                  <p className="text-xs text-gray-500">当月離脱</p>
                </div>
                <p className="text-3xl font-bold text-red-500">{summary.churned}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* デビュー前ステップ内訳 */}
        {summary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">デビュー前 — ステップ別人数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {summary.preDebut.map(({ step, count }) => (
                  <div key={step} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border">
                    <span className="text-xs font-medium text-gray-500">{STEP_LABELS[step] ?? `STEP ${step}`}</span>
                    <span className="text-lg font-bold text-indigo-600">{count}</span>
                    <span className="text-xs text-gray-400">人</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* フィルター */}
        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {teams.map((t) => (
              <button
                key={t}
                onClick={() => setFilterTeam(t)}
                className={`px-3 py-1.5 ${filterTeam === t ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {["全員", "デビュー済み", "デビュー前", "離脱"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 ${filterStatus === s ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* アポインター一覧 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              アポインター一覧 <span className="font-normal text-gray-400 ml-1">({appointers.length}人)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {appointers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">該当するアポインターがいません</p>
            ) : (
              <div className="divide-y">
                {appointers.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AM一覧 */}
        {ams.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">
                アポインターマネージャー <span className="font-normal text-gray-400 ml-1">({ams.length}人)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {ams.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </PageLayout>
  );
}
