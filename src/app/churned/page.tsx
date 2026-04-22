"use client";

/**
 * 離脱データページ — 全ロール共通
 * 離脱したアポインターの一覧・統計を表示
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, UserX, Clock, AlertCircle } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import type { Role } from "@/types/user";

// ─── 型 ────────────────────────────────────────────────────────────
interface ChurnedUser {
  id: string;
  nickname?: string;
  name?: string;
  team?: string;
  line_picture_url?: string;
  icon_image_url?: string;
  churned_at: string;
  registered_at: string | null;
  completedStepCount: number;
  phaseLabel: string;
  stepLabel: string;
  daysUntilChurn: number | null;
  churnedReason: string;
}

interface PhaseCount { phase: string; count: number; }
interface ReasonCount { reason: string; count: number; }

interface Stats {
  total: number;
  avgDays: number | null;
  phaseCount: PhaseCount[];
  reasonCount: ReasonCount[];
}

// ─── 離脱原因編集 ─────────────────────────────────────────────────
function ReasonEditor({ userId, initial, onSaved }: { userId: string; initial: string; onSaved: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/churned", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, churnedReason: value }),
    });
    onSaved(value);
    setSaving(false);
  }

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="例: モチベーション低下、時間不足、など"
        className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 bg-white"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || value === initial}
          className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white disabled:opacity-40 hover:bg-red-600"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

// ─── 離脱メンバー展開行 ────────────────────────────────────────────
function ChurnedMemberRow({ user: u, onReasonSaved }: { user: ChurnedUser; onReasonSaved: (id: string, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;

  const churnDate = new Date(u.churned_at).toLocaleDateString("ja-JP");
  const joinDate  = u.registered_at ? new Date(u.registered_at).toLocaleDateString("ja-JP") : "—";

  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0 grayscale opacity-60" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <span className="text-xs text-red-400">{displayName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">{displayName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">離脱</span>
            {u.team && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{u.team}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {u.phaseLabel}（{u.stepLabel}）· 離脱日: {churnDate}
            {u.daysUntilChurn != null && <span className="ml-1">· {u.daysUntilChurn}日間</span>}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="bg-red-50/30 px-4 pb-4 pt-3 border-t border-red-50 space-y-3">
          {/* 基本情報 */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-0">
            {[
              { label: "チーム",    value: u.team ?? "—" },
              { label: "採用日",    value: joinDate },
              { label: "離脱日",    value: churnDate },
              { label: "在籍期間",  value: u.daysUntilChurn != null ? `${u.daysUntilChurn}日` : "—" },
              { label: "離脱時",    value: `${u.phaseLabel}（${u.stepLabel}）` },
            ].map(({ label, value }, i, arr) => (
              <div key={label} className={`flex items-center gap-3 py-2 text-sm ${i < arr.length - 1 ? "border-b border-gray-50" : ""}`}>
                <span className="text-gray-400 text-xs w-16 shrink-0">{label}</span>
                <span className="text-gray-800 font-medium">{value}</span>
              </div>
            ))}
          </div>

          {/* 離脱原因 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">離脱原因</p>
            <ReasonEditor userId={u.id} initial={u.churnedReason} onSaved={(v) => onReasonSaved(u.id, v)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 統計セル ─────────────────────────────────────────────────────
function StatCell({ label, value, sub, icon, color = "text-gray-800" }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-3 py-3 flex items-center gap-2.5">
      <div className="shrink-0 text-red-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── メインページ ──────────────────────────────────────────────────
export default function ChurnedPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<ChurnedUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && !["Admin", "AM", "AM_Sales", "Sales"].includes(session.user.role)) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/churned");
      if (res.ok) {
        const d = await res.json();
        setUsers(d.users ?? []);
        setStats(d.stats ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  function handleReasonSaved(id: string, reason: string) {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, churnedReason: reason } : u));
  }

  const { nickname, name, image, role, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "";

  return (
    <PageLayout title="離脱データ" role={role as Role} userName={userName} userImage={image} userTeam={team}>
      <div className="max-w-2xl mx-auto space-y-5">

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <>
            {/* 統計セクション */}
            {stats && (
              <div className="space-y-3">
                {/* 数字 */}
                <div className="grid grid-cols-2 gap-2">
                  <StatCell
                    label="離脱人数"
                    value={stats.total}
                    sub="人"
                    icon={<UserX className="w-5 h-5" />}
                    color="text-red-600"
                  />
                  <StatCell
                    label="平均離脱期間"
                    value={stats.avgDays != null ? `${stats.avgDays}日` : "—"}
                    sub={stats.avgDays != null ? "採用〜離脱" : "データなし"}
                    icon={<Clock className="w-5 h-5" />}
                  />
                  {stats.reasonCount.length > 0 && (
                    <div className="col-span-2 bg-white rounded-xl border border-gray-100 px-3 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-xs font-semibold text-gray-700">主な離脱原因</p>
                      </div>
                      <div className="space-y-1.5">
                        {stats.reasonCount.slice(0, 5).map(({ reason, count }) => (
                          <div key={reason} className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 truncate flex-1 mr-2">{reason}</span>
                            <span className="text-xs font-bold text-red-500 shrink-0">{count}件</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 離脱タイミング（フェーズ別） */}
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-700 mb-3">離脱タイミング（フェーズ別）</p>
                  <div className="grid grid-cols-2 gap-2">
                    {stats.phaseCount.map(({ phase, count }) => (
                      <div key={phase} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
                        <span className="text-xs text-gray-500">{phase}</span>
                        <span className="text-base font-bold text-red-500">{count}<span className="text-xs font-normal text-gray-400 ml-0.5">人</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 離脱メンバー一覧 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-bold text-gray-700">離脱メンバー一覧</p>
                <p className="text-xs text-gray-400 mt-0.5">名前をタップすると詳細・離脱原因を編集できます</p>
              </div>
              {users.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-gray-300">
                  <UserX className="w-10 h-10" />
                  <p className="text-sm">離脱メンバーはいません</p>
                </div>
              ) : (
                <div>
                  {users.map((u) => (
                    <ChurnedMemberRow key={u.id} user={u} onReasonSaved={handleReasonSaved} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
