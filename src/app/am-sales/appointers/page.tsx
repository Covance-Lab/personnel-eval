"use client";

/**
 * AM_Sales — アポインター管理
 *
 * 上部: チーム全体サマリー（総数・デビュー済み・デビュー前・当月離脱 / Phase1〜4）
 * タブ: 自分のアポインターチーム | 他AMのアポインターチーム
 *
 * 自分チームタブ: AMのアポインター管理と同じ（AppointerExpandRow）
 * 他AMチームタブ: AMの展開行（ステータス/アカウント/人事評価/プロフィール/メモ） + 配下アポインター
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, Users, UserCheck, UserX, TrendingUp, Calendar } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import AccountsView from "@/components/accounts/AccountsView";
import { ROADMAP_STEPS, ROADMAP_PHASES } from "@/types/roadmap";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Legend,
} from "recharts";

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

interface Summary {
  total: number;
  debuted: number;
  churned: number;
  phaseCount: { phase: string; label: string; count: number }[];
}

// ─── ステータスバッジ ──────────────────────────────────────────────
function StatusBadge({ user: u }: { user: UserRecord }) {
  if (u.role === "AM" || u.role === "AM_Sales") return <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold">AM</span>;
  if (u.churned_at || u.isChurned) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">離脱</span>;
  if (u.paused_at)  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">休止中</span>;
  if (u.debuted)    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">デビュー済</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">デビュー前</span>;
}

// ─── メモ編集（AMメモ） ───────────────────────────────────────────
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
          className="px-3 py-1 text-xs font-medium rounded-lg text-white disabled:opacity-40 hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #cfa340, #e8c060)" }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

// ─── メモ編集（営業マンメモ） ─────────────────────────────────────
function SalesMemoEditor({ userId, initialValue, onSaved }: { userId: string; initialValue: string; onSaved: (v: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value === initialValue) return;
    setSaving(true);
    const r = await fetch(`/api/roadmap/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sales_memo: value }),
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
        className="w-full text-xs rounded-lg border border-gray-200 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || value === initialValue}
          className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

// ─── 離脱・休止ステータス変更 ──────────────────────────────────────
function StatusChanger({ userId, churnedAt, pausedAt, onChanged }: {
  userId: string;
  churnedAt: string | null | undefined;
  pausedAt: string | null | undefined;
  onChanged: (field: "churned_at" | "paused_at", value: string | null) => void;
}) {
  const [showChurn, setShowChurn] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [churnDate, setChurnDate] = useState(churnedAt ? churnedAt.slice(0, 10) : "");
  const [pauseDate, setPauseDate] = useState(pausedAt  ? pausedAt.slice(0,  10) : "");
  const [saving, setSaving] = useState(false);

  async function saveField(field: "churned_at" | "paused_at", dateStr: string | null) {
    setSaving(true);
    await fetch(`/api/roadmap/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: dateStr ? new Date(dateStr).toISOString() : null }),
    });
    onChanged(field, dateStr ? new Date(dateStr).toISOString() : null);
    setSaving(false);
    setShowChurn(false);
    setShowPause(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">ステータス変更</p>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setShowChurn((v) => !v); setShowPause(false); }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-white text-red-500 border-red-200 hover:bg-red-50">
          {churnedAt ? "離脱日を変更" : "離脱"}
        </button>
        <button onClick={() => { setShowPause((v) => !v); setShowChurn(false); }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-white text-amber-600 border-amber-200 hover:bg-amber-50">
          {pausedAt ? "休止日を変更" : "休止"}
        </button>
        {(churnedAt || pausedAt) && (
          <button onClick={async () => {
            setSaving(true);
            if (churnedAt) { await fetch(`/api/roadmap/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ churned_at: null }) }); onChanged("churned_at", null); }
            if (pausedAt)  { await fetch(`/api/roadmap/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused_at:  null }) }); onChanged("paused_at",  null); }
            setSaving(false);
          }} disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-white text-gray-400 border-gray-200 hover:bg-gray-50">
            解除
          </button>
        )}
      </div>
      {showChurn && (
        <div className="flex items-center gap-2 mt-1">
          <input type="date" value={churnDate} onChange={(e) => setChurnDate(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400" />
          <button onClick={() => saveField("churned_at", churnDate || null)}
            disabled={saving || !churnDate}
            className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white disabled:opacity-40 hover:bg-red-700">
            {saving ? "保存中..." : "離脱日を保存"}
          </button>
        </div>
      )}
      {showPause && (
        <div className="flex items-center gap-2 mt-1">
          <input type="date" value={pauseDate} onChange={(e) => setPauseDate(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400" />
          <button onClick={() => saveField("paused_at", pauseDate || null)}
            disabled={saving || !pauseDate}
            className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white disabled:opacity-40 hover:bg-amber-700">
            {saving ? "保存中..." : "休止日を保存"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 評価パネル ───────────────────────────────────────────────────
interface EvalData {
  discipline_self: number | null; absorption_self: number | null;
  contribution_self: number | null; thinking_self: number | null;
  discipline_other: number | null; absorption_other: number | null;
  contribution_other: number | null; thinking_other: number | null;
}

function EvalPanel({ userId }: { userId: string }) {
  const [eval_, setEval] = useState<EvalData | null | "loading">("loading");

  useEffect(() => {
    const now = new Date();
    fetch(`/api/evaluation?view=member&userId=${userId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setEval(d?.evaluation ?? null))
      .catch(() => setEval(null));
  }, [userId]);

  if (eval_ === "loading") return <p className="text-xs text-gray-400 text-center py-4">読み込み中...</p>;
  if (!eval_) return <p className="text-xs text-gray-400 text-center py-6">今月の評価データがありません</p>;

  const axes = ["規律性", "吸収力", "貢献度", "思考力"];
  const selfVals  = [eval_.discipline_self, eval_.absorption_self, eval_.contribution_self, eval_.thinking_self];
  const otherVals = [eval_.discipline_other, eval_.absorption_other, eval_.contribution_other, eval_.thinking_other];
  const hasData = selfVals.some((v) => v != null) || otherVals.some((v) => v != null);
  if (!hasData) return <p className="text-xs text-gray-400 text-center py-6">評価データがありません</p>;

  const radarData = axes.map((axis, i) => ({
    axis,
    自己評価: selfVals[i]  ?? 0,
    他者評価: otherVals[i] ?? 0,
  }));

  return (
    <div className="bg-white rounded-lg border p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">今月の評価（レーダーチャート）</p>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={radarData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
          <Radar name="自己評価" dataKey="自己評価" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
          <Radar name="他者評価" dataKey="他者評価" stroke="#ec4899" fill="#ec4899" fillOpacity={0.2} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── プロフィールタブ ───────────────────────────────────────────────
function ProfileTab({ u, showAmName = true }: { u: UserRecord; showAmName?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3">
          {[
            { label: "チーム",  value: u.team ?? "—" },
            ...(showAmName ? [{ label: "担当AM", value: u.amName ?? "—" }] : []),
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
          <div className="flex items-center gap-3 py-2 border-t border-gray-50">
            <span className="text-gray-400 text-xs w-16 shrink-0">ステータス</span>
            <StatusBadge user={u} />
          </div>
          {u.self_introduction?.trim() && (
            <div className="py-2.5 border-t border-gray-50">
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

// ─── アポインター展開行（自分チームタブ用・AMアポ管と同じ） ─────────
const APPOINTER_TABS = [
  { key: "status"   as const, label: "ステータス" },
  { key: "accounts" as const, label: "アカウント" },
  { key: "eval"     as const, label: "人事評価" },
  { key: "profile"  as const, label: "プロフィール" },
];
type AppointerTabKey = typeof APPOINTER_TABS[number]["key"];

function AppointerExpandRow({
  user: u,
  canEditAmMemo,
  onMemoSaved,
  onSalesMemoSaved,
  onStatusChanged,
}: {
  user: UserRecord;
  canEditAmMemo: boolean;
  onMemoSaved: (id: string, memo: string) => void;
  onSalesMemoSaved?: (id: string, memo: string) => void;
  onStatusChanged?: (id: string, field: "churned_at" | "paused_at", value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AppointerTabKey>("status");
  const [hireDate, setHireDate] = useState(u.registered_at ? u.registered_at.slice(0, 10) : "");
  const [savingHire, setSavingHire] = useState(false);

  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;
  const progressPct = Math.round((u.completedStepCount / ROADMAP_STEPS.length) * 100);

  async function saveHireDate() {
    if (!hireDate) return;
    setSavingHire(true);
    await fetch(`/api/roadmap/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registered_at: new Date(hireDate + "T00:00:00").toISOString() }),
    });
    setSavingHire(false);
  }

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
            <span className="text-sm font-medium">{displayName}</span>
            <StatusBadge user={u} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {u.debuted ? "デビュー完了" : `STEP${u.completedStepCount} 完了`}
          </p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-xs text-gray-400">DM数　B設定　B設定率</p>
          <p className="text-sm font-bold">{u.dmCount}　{u.bSetCount}　{u.bSetRate != null ? `${Number(u.bSetRate).toFixed(2)}%` : "—"}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="bg-gray-50 px-4 pb-4 pt-3 border-t space-y-3">
          <div className="flex gap-1 bg-gray-200 rounded-lg p-0.5">
            {APPOINTER_TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${tab === t.key ? "bg-white shadow-sm" : "text-gray-500"}`}
                style={tab === t.key ? { color: "#cfa340" } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "status" && (
            <div className="space-y-4">
              {/* 採用日 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 shrink-0">アポインター採用日：</span>
                <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)}
                  className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                <button onClick={saveHireDate} disabled={savingHire || !hireDate}
                  className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700">
                  {savingHire ? "保存中" : "保存"}
                </button>
              </div>

              {/* デビューまでの進捗 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-700">デビューまでの進捗</p>
                  <span className="text-sm font-bold text-indigo-600">{progressPct}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-xs text-gray-400">{u.completedStepCount} / {ROADMAP_STEPS.length} ステップ完了</p>
              </div>

              {/* フェーズ別ステップ */}
              <div className="space-y-2">
                {ROADMAP_PHASES.map((phase) => (
                  <div key={phase.id} className="bg-white rounded-lg border p-2.5">
                    <p className="text-xs font-semibold text-gray-600 mb-1.5">{phase.label}</p>
                    <div className="space-y-0.5">
                      {phase.steps.map((step) => {
                        const idx = ROADMAP_STEPS.findIndex((r) => r.id === step.id);
                        const done   = idx < u.completedStepCount;
                        const active = idx === u.completedStepCount;
                        return (
                          <div key={step.id} className={`flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded ${
                            done ? "text-gray-400" : active ? "text-indigo-700 font-semibold bg-indigo-50" : "text-gray-300"
                          }`}>
                            <span className="shrink-0">{done ? "✓" : active ? "●" : "○"}</span>
                            <span className={done ? "line-through" : ""}>{idx + 1}. {step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 離脱・休止 */}
              {onStatusChanged && (
                <StatusChanger
                  userId={u.id}
                  churnedAt={u.churned_at}
                  pausedAt={u.paused_at}
                  onChanged={(field, value) => onStatusChanged(u.id, field, value)}
                />
              )}

              {/* AMのメモ */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">AMのメモ</p>
                {canEditAmMemo ? (
                  <AMMemoEditor userId={u.id} initialValue={u.amMemo} onSaved={(v) => onMemoSaved(u.id, v)} />
                ) : (
                  <p className="text-xs text-gray-600 bg-white rounded-lg border p-2.5">{u.amMemo || <span className="text-gray-300">メモなし</span>}</p>
                )}
              </div>

              {/* 営業マンのメモ */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">営業マンのメモ</p>
                <SalesMemoEditor
                  userId={u.id}
                  initialValue={u.salesMemo}
                  onSaved={(v) => onSalesMemoSaved?.(u.id, v)}
                />
              </div>
            </div>
          )}
          {tab === "accounts" && <AccountsView userId={u.id} />}
          {tab === "eval"     && <EvalPanel userId={u.id} />}
          {tab === "profile"  && <ProfileTab u={u} />}
        </div>
      )}
    </div>
  );
}

// ─── AM展開行（他AMチームタブ用） ──────────────────────────────────
const AM_TABS = [
  { key: "status"   as const, label: "ステータス" },
  { key: "accounts" as const, label: "アカウント" },
  { key: "eval"     as const, label: "人事評価" },
  { key: "profile"  as const, label: "プロフィール" },
];
type AMTabKey = typeof AM_TABS[number]["key"];

const AM_TOTAL_STEPS = 6;

function AMExpandRow({
  user: u,
  appointers,
  onMemoSaved,
  onAppointerMemoSaved,
  onAppointerSalesMemoSaved,
  onAppointerStatusChanged,
}: {
  user: UserRecord;
  appointers: UserRecord[];
  onMemoSaved: (id: string, memo: string) => void;
  onAppointerMemoSaved: (id: string, memo: string) => void;
  onAppointerSalesMemoSaved: (id: string, memo: string) => void;
  onAppointerStatusChanged: (id: string, field: "churned_at" | "paused_at", value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AMTabKey>("status");

  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* AM行ヘッダー */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={displayName} className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-teal-100" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <span className="text-sm text-teal-600 font-bold">{displayName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">{displayName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold">AM</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">配下 {appointers.length}名</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t">
          {/* AMの詳細タブ */}
          <div className="bg-gray-50 px-4 pb-4 pt-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500">AMのデータ</p>
            <div className="flex gap-1 bg-gray-200 rounded-lg p-0.5">
              {AM_TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${tab === t.key ? "bg-white shadow-sm" : "text-gray-500"}`}
                  style={tab === t.key ? { color: "#cfa340" } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "status" && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">ステップ進捗</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {Array.from({ length: AM_TOTAL_STEPS }, (_, i) => (
                      <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-default select-none ${
                        u.completedStepCount > i ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-400 border-gray-200"
                      }`}>
                        STEP {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">AMのメモ</p>
                  <AMMemoEditor userId={u.id} initialValue={u.amMemo} onSaved={(v) => onMemoSaved(u.id, v)} />
                </div>
              </div>
            )}
            {tab === "accounts" && <AccountsView userId={u.id} />}
            {tab === "eval"     && <EvalPanel userId={u.id} />}
            {tab === "profile"  && <ProfileTab u={u} showAmName={false} />}
          </div>

          {/* 配下アポインター */}
          {appointers.length > 0 && (
            <div className="border-t">
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-gray-500">配下のアポインター（{appointers.length}名）</p>
              </div>
              <div>
                {appointers.map((ap) => (
                  <AppointerExpandRow
                    key={ap.id}
                    user={ap}
                    canEditAmMemo={false}
                    onMemoSaved={onAppointerMemoSaved}
                    onSalesMemoSaved={onAppointerSalesMemoSaved}
                    onStatusChanged={onAppointerStatusChanged}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── サマリーカード ────────────────────────────────────────────────
function SummaryCard({ summary }: { summary: Summary }) {
  const preDebut = (summary.phaseCount ?? []).reduce((s, p) => s + p.count, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="grid grid-cols-2 gap-3">
        {/* 左列: ステータス */}
        <div className="space-y-2">
          {[
            { icon: <Users className="w-3.5 h-3.5 text-gray-400" />,    label: "アポインター総数", value: summary.total,   color: "text-gray-800" },
            { icon: <UserCheck className="w-3.5 h-3.5 text-green-500" />, label: "デビュー済み",     value: summary.debuted, color: "text-green-600" },
            { icon: <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />, label: "デビュー前",       value: preDebut,        color: "text-indigo-600" },
            { icon: <UserX className="w-3.5 h-3.5 text-red-400" />,     label: "当月離脱",         value: summary.churned, color: "text-red-500" },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
              <div className="flex items-center gap-1.5">
                {icon}
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <span className={`text-lg font-bold ${color}`}>{value}<span className="text-xs font-normal text-gray-400 ml-0.5">人</span></span>
            </div>
          ))}
        </div>
        {/* 右列: フェーズ */}
        <div className="space-y-2">
          {(summary.phaseCount ?? []).map(({ label, count }) => (
            <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-lg font-bold text-indigo-600">{count}<span className="text-xs font-normal text-gray-400 ml-0.5">人</span></span>
            </div>
          ))}
        </div>
      </div>
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
  const [summary, setSummary] = useState<Summary | null>(null);
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
        setSummary(data.summary ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const myId = session?.user.dbId ?? "";
  const userName = session?.user.nickname ?? session?.user.name ?? "";

  function updateUser(id: string, patch: Partial<UserRecord>) {
    setAllUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...patch } : u));
  }

  // 自分管轄のアポインター
  const ownAppointers = allUsers.filter(
    (u) => u.role === "Appointer" && u.education_mentor_user_id === myId
  );

  // 他AM（自分以外のAM/AM_Sales）とそのアポインター
  const otherAMs = allUsers.filter(
    (u) => ["AM", "AM_Sales"].includes(u.role) && u.id !== myId
  );
  const otherAppointers = allUsers.filter(
    (u) => u.role === "Appointer" && u.education_mentor_user_id !== myId
  );

  return (
    <PageLayout role="AM_Sales" userName={userName}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* サマリー */}
        {summary && <SummaryCard summary={summary} />}

        {/* ビュー切り替えタブ */}
        <div className="flex gap-1 bg-gray-200 rounded-xl p-1">
          <button
            onClick={() => router.replace("/am-sales/appointers?view=own")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === "own" ? "bg-white shadow-sm text-amber-700" : "text-gray-500"
            }`}
          >
            自分のチーム ({ownAppointers.length}名)
          </button>
          <button
            onClick={() => router.replace("/am-sales/appointers?view=others")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === "others" ? "bg-white shadow-sm text-amber-700" : "text-gray-500"
            }`}
          >
            他AMのチーム ({otherAppointers.length}名)
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">読み込み中...</div>
        ) : view === "own" ? (
          // ── 自分管轄ビュー ─────────────────────────────────────
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-700">自分のアポインターチーム</p>
              <p className="text-xs text-gray-400 mt-0.5">{ownAppointers.length}名 · 名前をタップすると詳細が展開されます</p>
            </div>
            {ownAppointers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-gray-300">
                <Users className="w-10 h-10" />
                <p className="text-sm">アポインターが設定されていません</p>
              </div>
            ) : (
              <div>
                {ownAppointers.map((u) => (
                  <AppointerExpandRow
                    key={u.id}
                    user={u}
                    canEditAmMemo
                    onMemoSaved={(id, memo) => updateUser(id, { amMemo: memo })}
                    onSalesMemoSaved={(id, memo) => updateUser(id, { salesMemo: memo })}
                    onStatusChanged={(id, field, value) => updateUser(id, { [field]: value })}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // ── 他AM管轄ビュー ─────────────────────────────────────
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Users className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-bold text-gray-700">他AMのアポインターチーム</p>
              <span className="text-xs text-gray-400">AM {otherAMs.length}名</span>
            </div>
            {otherAMs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-gray-300">
                <Users className="w-10 h-10" />
                <p className="text-sm">他AMが見つかりません</p>
              </div>
            ) : (
              otherAMs.map((am) => {
                const amAppointers = otherAppointers.filter((u) => u.education_mentor_user_id === am.id);
                return (
                  <AMExpandRow
                    key={am.id}
                    user={am}
                    appointers={amAppointers}
                    onMemoSaved={(id, memo) => updateUser(id, { amMemo: memo })}
                    onAppointerMemoSaved={(id, memo) => updateUser(id, { amMemo: memo })}
                    onAppointerSalesMemoSaved={(id, memo) => updateUser(id, { salesMemo: memo })}
                    onAppointerStatusChanged={(id, field, value) => updateUser(id, { [field]: value })}
                  />
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
