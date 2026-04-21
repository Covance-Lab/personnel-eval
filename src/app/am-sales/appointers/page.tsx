"use client";

/**
 * AM_Sales — アポインター管理
 * ?view=own   → 自分管轄のアポインター
 * ?view=others → 他AM管轄のアポインター
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import AccountsView from "@/components/accounts/AccountsView";
import { ROADMAP_STEPS } from "@/types/roadmap";

// ─── 型 ────────────────────────────────────────────────────────────
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
  churned_at?: string | null;
  paused_at?: string | null;
  registered_at?: string | null;
  dmCount: number;
  bSetCount: number;
  bSetRate: number | null;
  amMemo: string;
  salesMemo: string;
  amName: string | null;
  education_mentor_user_id?: string | null;
  age?: number | null;
  gender?: string | null;
  hobbies?: string | null;
  self_introduction?: string | null;
  featured_image_1_url?: string | null;
  featured_image_2_url?: string | null;
}

// ─── ステータスバッジ ──────────────────────────────────────────────
function StatusBadge({ user: u }: { user: UserRecord }) {
  if (u.churned_at) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">離脱</span>;
  if (u.paused_at)  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">休止中</span>;
  if (u.debuted)    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">デビュー済</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">デビュー前</span>;
}

// ─── AMメモ編集 ───────────────────────────────────────────────────
function AMMemoEditor({ userId, initialValue, onSaved }: { userId: string; initialValue: string; onSaved: (v: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value === initialValue) return;
    setSaving(true);
    const r = await fetch(`/api/roadmap/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ am_memo: value }),
    });
    if (r.ok) onSaved(value);
    setSaving(false);
  }

  return (
    <div className="space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="メモを入力..."
        className="w-full text-xs rounded-lg border border-gray-200 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 bg-white"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || value === initialValue}
          className="px-3 py-1 text-xs font-medium rounded-lg text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(135deg, #cfa340, #e8c060)" }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

// ─── プロフィールタブ ───────────────────────────────────────────────
function ProfileTab({ u }: { u: UserRecord }) {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 space-y-0">
          {[
            { label: "チーム",  value: u.team ?? "—" },
            { label: "担当AM", value: u.amName ?? "—" },
            { label: "採用日",  value: u.registered_at ? new Date(u.registered_at).toLocaleDateString("ja-JP") : "—" },
            { label: "年齢",    value: u.age ? `${u.age}歳` : "—" },
            { label: "性別",    value: u.gender ?? "—" },
            { label: "趣味",    value: u.hobbies?.trim() || "—" },
          ].map(({ label, value }, i, arr) => (
            <div key={label} className={`flex items-center gap-3 py-2 text-sm ${i < arr.length - 1 ? "border-b border-gray-50" : ""}`}>
              <span className="text-gray-400 text-xs w-16 shrink-0">{label}</span>
              <span className="text-gray-800 font-medium">{value}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 py-2 border-b border-gray-50">
            <span className="text-gray-400 text-xs w-16 shrink-0">ステータス</span>
            <StatusBadge user={u} />
          </div>
          {u.self_introduction?.trim() && (
            <div className="py-2.5">
              <p className="text-gray-400 text-xs mb-1.5">自己紹介</p>
              <p className="text-gray-700 text-sm whitespace-pre-line leading-relaxed">{u.self_introduction}</p>
            </div>
          )}
        </div>
      </div>

      {(u.featured_image_1_url || u.featured_image_2_url) && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">イチオシ写真</p>
          <div className={`grid gap-2 ${u.featured_image_1_url && u.featured_image_2_url ? "grid-cols-2" : "grid-cols-1"}`}>
            {u.featured_image_1_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.featured_image_1_url} alt="写真1" className="w-full rounded-xl border border-gray-100 shadow-sm" />
            )}
            {u.featured_image_2_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.featured_image_2_url} alt="写真2" className="w-full rounded-xl border border-gray-100 shadow-sm" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 展開行 ───────────────────────────────────────────────────────
const TABS = [
  { key: "status",   label: "ステータス" },
  { key: "accounts", label: "アカウント" },
  { key: "profile",  label: "プロフィール" },
] as const;
type TabKey = typeof TABS[number]["key"];

function AppointerRow({
  user: u,
  canEditAmMemo,
  onMemoSaved,
}: {
  user: UserRecord;
  canEditAmMemo: boolean;
  onMemoSaved: (id: string, memo: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("status");
  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* 行ヘッダー */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3"
      >
        {/* アバター */}
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={displayName} className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <span className="text-xs text-gray-400">{displayName.charAt(0)}</span>
          </div>
        )}

        {/* 名前・ステップ */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{displayName}</span>
            <StatusBadge user={u} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {u.debuted ? "デビュー完了" : `STEP${u.completedStepCount} 完了`}
          </p>
        </div>

        {/* 今月の数値 */}
        <div className="text-right shrink-0 mr-1">
          <div className="flex gap-4 text-xs text-gray-400">
            <div>DM<br /><span className="text-gray-800 font-bold text-base">{u.dmCount}</span></div>
            <div>B設定<br /><span className="text-gray-800 font-bold text-base">{u.bSetCount}</span></div>
            <div>B設定率<br /><span className="text-gray-800 font-bold text-sm">{u.bSetRate != null ? `${u.bSetRate}%` : "—"}</span></div>
          </div>
        </div>

        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
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
                  tab === t.key ? "bg-white shadow-sm" : "text-gray-500"
                }`}
                style={tab === t.key ? { color: "#cfa340" } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ステータス */}
          {tab === "status" && (
            <div className="space-y-3">
              {/* ロードマップ進捗 */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">ステップ進捗</p>
                <div className="flex gap-1 flex-wrap">
                  {ROADMAP_STEPS.map((step, idx) => {
                    const done   = idx < u.completedStepCount;
                    const active = idx === u.completedStepCount;
                    return (
                      <div key={step.id} className={`text-xs px-1.5 py-0.5 rounded ${
                        done ? "text-gray-400" : active ? "text-indigo-700 font-semibold bg-indigo-50" : "text-gray-300"
                      }`}>
                        <span className="shrink-0">{done ? "✓" : active ? "●" : "○"}</span>
                        {" "}{idx + 1}. {step.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AMメモ（自分管轄のみ編集可） */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">AMのメモ</p>
                {canEditAmMemo ? (
                  <AMMemoEditor
                    userId={u.id}
                    initialValue={u.amMemo}
                    onSaved={(v) => onMemoSaved(u.id, v)}
                  />
                ) : (
                  <p className="text-xs text-gray-600 bg-white rounded-lg border p-2.5">
                    {u.amMemo || <span className="text-gray-300">メモなし</span>}
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "accounts" && <AccountsView userId={u.id} />}
          {tab === "profile" && <ProfileTab u={u} />}
        </div>
      )}
    </div>
  );
}

// ─── AM グループ行（他AM管轄ビュー用） ────────────────────────────
function AMGroupSection({ am, appointers }: { am: UserRecord; appointers: UserRecord[] }) {
  const [open, setOpen] = useState(true);
  const avatar = am.icon_image_url ?? am.line_picture_url;
  const displayName = am.nickname ?? am.name ?? am.id;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={displayName} className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-xs text-indigo-600 font-bold">{displayName.charAt(0)}</span>
          </div>
        )}
        <span className="text-sm font-bold text-gray-700">{displayName}</span>
        <span className="text-xs text-gray-400 ml-1">{appointers.length}名</span>
        <span className="ml-auto">{open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}</span>
      </button>

      {open && (
        <div className="space-y-2 pl-2">
          {appointers.length === 0 ? (
            <p className="text-xs text-gray-400 pl-2">アポインターなし</p>
          ) : (
            appointers.map((ap) => (
              <AppointerRow
                key={ap.id}
                user={ap}
                canEditAmMemo={false}
                onMemoSaved={() => {}}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── メインページ本体 ───────────────────────────────────────────────
function AppointersPageInner() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") ?? "own") as "own" | "others";

  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && !["AM_Sales", "Admin"].includes(session.user.role)) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const res = await fetch("/api/hr");
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const myId = session?.user.dbId ?? "";
  const userName = session?.user.nickname ?? session?.user.name ?? "";

  // 自分管轄のアポインター
  const ownAppointers = allUsers.filter(
    (u) => u.role === "Appointer" && u.education_mentor_user_id === myId
  );

  // 他AMとそのアポインター
  const otherAMs = allUsers.filter(
    (u) => ["AM", "AM_Sales"].includes(u.role) && u.id !== myId
  );
  const otherAppointers = allUsers.filter(
    (u) => u.role === "Appointer" && u.education_mentor_user_id !== myId
  );

  function handleMemoSaved(id: string, memo: string) {
    setAllUsers((prev) => prev.map((u) => u.id === id ? { ...u, amMemo: memo } : u));
  }

  return (
    <PageLayout role="AM_Sales" userName={userName}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* ビュー切り替えタブ */}
        <div className="flex gap-1 bg-gray-200 rounded-xl p-1">
          <button
            onClick={() => router.replace("/am-sales/appointers?view=own")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === "own" ? "bg-white shadow-sm text-amber-700" : "text-gray-500"
            }`}
          >
            自分管轄 ({ownAppointers.length}名)
          </button>
          <button
            onClick={() => router.replace("/am-sales/appointers?view=others")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === "others" ? "bg-white shadow-sm text-amber-700" : "text-gray-500"
            }`}
          >
            他AM管轄 ({otherAppointers.length}名)
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">読み込み中...</div>
        ) : view === "own" ? (
          // ── 自分管轄ビュー ─────────────────────────────────────
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-bold text-gray-700">自分管轄のアポインター</p>
              <span className="text-xs text-gray-400">{ownAppointers.length}名</span>
            </div>
            {ownAppointers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-gray-300">
                <Users className="w-10 h-10" />
                <p className="text-sm">アポインターが設定されていません</p>
              </div>
            ) : (
              ownAppointers.map((u) => (
                <AppointerRow
                  key={u.id}
                  user={u}
                  canEditAmMemo
                  onMemoSaved={handleMemoSaved}
                />
              ))
            )}
          </div>
        ) : (
          // ── 他AM管轄ビュー ─────────────────────────────────────
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-bold text-gray-700">他AM管轄のアポインター</p>
              <span className="text-xs text-gray-400">AM {otherAMs.length}名 / アポインター {otherAppointers.length}名</span>
            </div>
            {otherAMs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-gray-300">
                <Users className="w-10 h-10" />
                <p className="text-sm">他AMが見つかりません</p>
              </div>
            ) : (
              otherAMs.map((am) => {
                const amAppointers = otherAppointers.filter(
                  (u) => u.education_mentor_user_id === am.id
                );
                return (
                  <AMGroupSection key={am.id} am={am} appointers={amAppointers} />
                );
              })
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function AppointersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">読み込み中...</div>}>
      <AppointersPageInner />
    </Suspense>
  );
}
