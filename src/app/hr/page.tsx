"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserCheck, UserX, TrendingUp,
  ChevronDown, ChevronUp, Calendar,
} from "lucide-react";
import AccountsView from "@/components/accounts/AccountsView";
import PageLayout from "@/components/layout/PageLayout";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Legend,
} from "recharts";
import { ROADMAP_STEPS, ROADMAP_PHASES } from "@/types/roadmap";

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

// ステップツールチップ付きボタン
function StepBadge({ step, label, completed }: { step: number; label: string; completed: boolean }) {
  return (
    <div className="relative group">
      <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-default select-none ${
        completed ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-400 border-gray-200"
      }`}>
        STEP {step}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20 w-44 bg-gray-800 text-white text-xs rounded-lg px-2.5 py-2 text-center pointer-events-none shadow-lg">
        <p className="font-semibold mb-0.5">STEP {step}</p>
        <p className="text-gray-300">{label}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
}

// インライン編集メモ（Sales用）
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
      <div className="flex items-center justify-between">
        {saving ? <p className="text-xs text-gray-400">保存中...</p> : <span />}
        <button
          onClick={save}
          disabled={saving || value === initialValue}
          className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
}

// AM memo editor
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
        className="w-full text-xs rounded-lg border border-gray-200 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
      />
      <div className="flex items-center justify-between">
        {saving ? <p className="text-xs text-gray-400">保存中...</p> : <span />}
        <button
          onClick={save}
          disabled={saving || value === initialValue}
          className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
}

// 離脱・休止ステータス変更
function StatusChanger({ userId, churnedAt, pausedAt, onChanged }: {
  userId: string;
  churnedAt: string | null | undefined;
  pausedAt: string | null | undefined;
  onChanged: (field: "churned_at" | "paused_at", value: string | null) => void;
}) {
  const [showChurn, setShowChurn] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [churnDate, setChurnDate] = useState(churnedAt ? churnedAt.slice(0, 10) : "");
  const [pauseDate, setPauseDate] = useState(pausedAt ? pausedAt.slice(0, 10) : "");
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
        <button
          onClick={() => { setShowChurn((v) => !v); setShowPause(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            churnedAt ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
          }`}
        >
          {churnedAt ? `離脱済み (${churnedAt.slice(0, 10)})` : "離脱"}
        </button>
        <button
          onClick={() => { setShowPause((v) => !v); setShowChurn(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            pausedAt ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-600 border-gray-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
          }`}
        >
          {pausedAt ? `休止中 (${pausedAt.slice(0, 10)})` : "休止"}
        </button>
        {(churnedAt || pausedAt) && (
          <button
            onClick={async () => {
              setSaving(true);
              if (churnedAt) { await fetch(`/api/roadmap/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ churned_at: null }) }); onChanged("churned_at", null); }
              if (pausedAt)  { await fetch(`/api/roadmap/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused_at: null }) }); onChanged("paused_at", null); }
              setSaving(false);
            }}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
          >
            解除
          </button>
        )}
      </div>
      {showChurn && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="date"
            value={churnDate}
            onChange={(e) => setChurnDate(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <button
            onClick={() => saveField("churned_at", churnDate || null)}
            disabled={saving || !churnDate}
            className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white disabled:opacity-40 hover:bg-red-700"
          >
            {saving ? "保存中..." : "離脱日を保存"}
          </button>
        </div>
      )}
      {showPause && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="date"
            value={pauseDate}
            onChange={(e) => setPauseDate(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button
            onClick={() => saveField("paused_at", pauseDate || null)}
            disabled={saving || !pauseDate}
            className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white disabled:opacity-40 hover:bg-amber-700"
          >
            {saving ? "保存中..." : "休止日を保存"}
          </button>
        </div>
      )}
    </div>
  );
}

interface PhaseCount {
  phase: string;
  label: string;
  count: number;
}

interface Summary {
  total: number;
  debuted: number;
  churned: number;
  phaseCount: PhaseCount[];
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

function getStepLabel(completedStepCount: number, total: number): string {
  if (completedStepCount <= 0) return "未着手";
  if (completedStepCount >= total) return "デビュー完了";
  return `STEP${completedStepCount} 完了`;
}

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
              { label: "稼働量",   s: eval_.workload_score,    o: eval_.workload_score },
              { label: "成果",     s: eval_.performance_score, o: eval_.performance_score },
              { label: "規律",    s: eval_.discipline_self,   o: eval_.discipline_other },
              { label: "吸収力",  s: eval_.absorption_self,   o: eval_.absorption_other },
              { label: "組織貢献", s: eval_.contribution_self, o: eval_.contribution_other },
              { label: "思考力",  s: eval_.thinking_self,     o: eval_.thinking_other },
            ].map(({ label, s, o }) => (
              <tr key={label}>
                <td className="px-3 py-1.5 font-medium text-gray-700">{label}</td>
                <td className="px-3 py-1.5 text-center text-indigo-600 font-semibold">{s != null ? s : "—"}</td>
                <td className="px-3 py-1.5 text-center text-pink-600 font-semibold">{o != null ? (Number.isInteger(Number(o)) ? o : Number(o).toFixed(1)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// プロフィールタブ（アポインター・AM共通）
// ────────────────────────────────────────────
function ProfileTab({ u, showAmName = true }: { u: UserRecord; showAmName?: boolean }) {
  const infoRows = [
    { label: "チーム",   value: u.team ?? "—" },
    ...(showAmName ? [{ label: "担当AM", value: u.amName ?? "—" }] : []),
    { label: "採用日",   value: u.registered_at ? new Date(u.registered_at).toLocaleDateString("ja-JP") : "—" },
    { label: "年齢",     value: u.age ? `${u.age}歳` : "—" },
    { label: "性別",     value: u.gender ?? "—" },
    { label: "趣味",     value: u.hobbies?.trim() || "—" },
  ];

  const hasBothPhotos = !!(u.featured_image_1_url && u.featured_image_2_url);

  return (
    <div className="space-y-3">
      {/* 基本情報カード */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 space-y-0">
          {infoRows.map(({ label, value }, i) => (
            <div
              key={label}
              className={`flex items-center gap-3 py-2 text-sm ${i < infoRows.length - 1 ? "border-b border-gray-50" : ""}`}
            >
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

      {/* イチオシ写真 */}
      {(u.featured_image_1_url || u.featured_image_2_url) && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">イチオシ写真</p>
          <div className={`grid gap-2 ${hasBothPhotos ? "grid-cols-2" : "grid-cols-1"}`}>
            {u.featured_image_1_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={u.featured_image_1_url}
                alt="写真1"
                className="w-full rounded-xl border border-gray-100 shadow-sm"
                style={{ display: "block" }}
              />
            )}
            {u.featured_image_2_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={u.featured_image_2_url}
                alt="写真2"
                className="w-full rounded-xl border border-gray-100 shadow-sm"
                style={{ display: "block" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// タブ付き展開行（アポインター用）
// ────────────────────────────────────────────
function AppointerExpandRow({
  user: u,
  currentUserRole,
  onMemoSaved,
  onStatusChanged,
}: {
  user: UserRecord;
  currentUserRole: string;
  onMemoSaved: (id: string, field: "amMemo" | "salesMemo", memo: string) => void;
  onStatusChanged: (id: string, field: "churned_at" | "paused_at", value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"status" | "accounts" | "eval" | "profile">("status");

  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;
  const bSetRateStr = u.bSetRate != null ? `${Number(u.bSetRate).toFixed(2)}%` : "—";
  const progressPct = Math.round((u.completedStepCount / ROADMAP_STEPS.length) * 100);

  const isAdmin = currentUserRole === "Admin";
  const isAM    = currentUserRole === "AM";
  const isSales = currentUserRole === "Sales";
  const canEditAmMemo    = isAdmin || isAM;
  const canSeeSalesMemo  = isAdmin || isSales;
  const canChangeStatus  = isAdmin || isAM || isSales;

  const [hireDate, setHireDate] = useState(u.registered_at ? u.registered_at.slice(0, 10) : "");
  const [savingHireDate, setSavingHireDate] = useState(false);
  const [stepCount, setStepCount] = useState(u.completedStepCount);
  const [savingStep, setSavingStep] = useState(false);

  async function saveHireDate() {
    if (!hireDate) return;
    setSavingHireDate(true);
    await fetch(`/api/roadmap/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registered_at: new Date(hireDate + "T00:00:00").toISOString() }),
    });
    setSavingHireDate(false);
  }

  async function saveStepCount(newCount: number) {
    setSavingStep(true);
    await fetch(`/api/roadmap/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed_step_count: newCount }),
    });
    setStepCount(newCount);
    setSavingStep(false);
  }

  const TABS = [
    { key: "status"   as const, label: "ステータス" },
    { key: "accounts" as const, label: "アカウント" },
    { key: "eval"     as const, label: "人事評価" },
    { key: "profile"  as const, label: "プロフィール" },
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
              {getStepLabel(u.completedStepCount, ROADMAP_STEPS.length)}
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
            <div className="space-y-4">

              {/* 採用日 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 shrink-0">アポインター採用日：</span>
                <input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  onClick={saveHireDate}
                  disabled={savingHireDate || !hireDate}
                  className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700"
                >
                  {savingHireDate ? "保存中" : "保存"}
                </button>
              </div>

              {/* デビューまでの進捗 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-700">デビューまでの進捗</p>
                  <span className="text-sm font-bold text-indigo-600">{Math.round((stepCount / ROADMAP_STEPS.length) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.round((stepCount / ROADMAP_STEPS.length) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">{stepCount} / {ROADMAP_STEPS.length} ステップ完了{savingStep ? "　保存中..." : ""}</p>
              </div>

              {/* フェーズ別ステップ（完了ボタン形式） */}
              <div className="space-y-2">
                {savingStep && <p className="text-xs text-gray-400 text-center">保存中...</p>}
                {ROADMAP_PHASES.map((phase) => (
                  <div key={phase.id} className="bg-white rounded-lg border p-2.5">
                    <p className="text-xs font-semibold text-gray-600 mb-2">{phase.label}</p>
                    <div className="space-y-1.5">
                      {phase.steps.map((step) => {
                        const idx  = ROADMAP_STEPS.findIndex((r) => r.id === step.id);
                        const done = idx < stepCount;
                        return (
                          <div key={step.id} className="flex items-center gap-2">
                            <span className={`flex-1 text-xs ${done ? "text-gray-400 line-through" : "text-gray-700"}`}>
                              {idx + 1}. {step.label}
                            </span>
                            <button
                              onClick={() => saveStepCount(done ? idx : idx + 1)}
                              disabled={savingStep}
                              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${
                                done
                                  ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                                  : "bg-white text-gray-400 border-gray-200 hover:border-indigo-400 hover:text-indigo-600"
                              }`}
                            >
                              {done ? "完了済" : "完了"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 離脱・休止ボタン */}
              {canChangeStatus && (
                <StatusChanger
                  userId={u.id}
                  churnedAt={u.churned_at}
                  pausedAt={u.paused_at}
                  onChanged={(field, value) => onStatusChanged(u.id, field, value)}
                />
              )}

              {/* AMのメモ（AM/Admin のみ表示・編集） */}
              {canEditAmMemo && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">AMのメモ</p>
                  <AMMemoEditor
                    userId={u.id}
                    initialValue={u.amMemo}
                    onSaved={(v) => onMemoSaved(u.id, "amMemo", v)}
                  />
                </div>
              )}

              {/* 営業マンのメモ（Sales/Admin のみ表示・編集） */}
              {canSeeSalesMemo && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">営業マンのメモ</p>
                  <SalesMemoEditor
                    userId={u.id}
                    initialValue={u.salesMemo}
                    onSaved={(v) => onMemoSaved(u.id, "salesMemo", v)}
                  />
                </div>
              )}
            </div>
          )}

          {/* アカウント */}
          {tab === "accounts" && <AccountsView userId={u.id} />}

          {/* 人事評価 */}
          {tab === "eval" && <EvalPanel userId={u.id} />}

          {/* プロフィール */}
          {tab === "profile" && (
            <ProfileTab u={u} />
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// タブ付き展開行（AM用）
// ────────────────────────────────────────────
function AMExpandRow({ user: u, onMemoSaved, onStatusChanged }: { user: UserRecord; onMemoSaved: (id: string, memo: string) => void; onStatusChanged?: (id: string, field: "churned_at" | "paused_at", value: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"status" | "accounts" | "eval" | "profile">("status");

  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;

  const TABS = [
    { key: "status"   as const, label: "ステータス" },
    { key: "accounts" as const, label: "アカウント" },
    { key: "eval"     as const, label: "人事評価" },
    { key: "profile"  as const, label: "プロフィール" },
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
                  {Array.from({ length: AM_TOTAL_STEPS }, (_, i) => (
                    <div key={i} className="relative group">
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-default select-none ${
                        u.completedStepCount > i
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-400 border-gray-200"
                      }`}>
                        STEP {i + 1}
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20 w-36 bg-gray-800 text-white text-xs rounded-lg px-2.5 py-2 text-center pointer-events-none shadow-lg">
                        <p className="font-semibold">STEP {i + 1}</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">営業マンのメモ <span className="text-gray-400 font-normal">（同チームの営業マン・管理者のみ表示）</span></p>
                <SalesMemoEditor
                  userId={u.id}
                  initialValue={u.salesMemo}
                  onSaved={(v) => onMemoSaved(u.id, v)}
                />
              </div>
              {/* ステータス変更 */}
              {onStatusChanged && (
                <StatusChanger
                  userId={u.id}
                  churnedAt={u.churned_at}
                  pausedAt={u.paused_at}
                  onChanged={(field, value) => onStatusChanged(u.id, field, value)}
                />
              )}
            </div>
          )}

          {/* アカウント */}
          {tab === "accounts" && <AccountsView userId={u.id} />}

          {/* 人事評価 */}
          {tab === "eval" && <EvalPanel userId={u.id} />}

          {/* プロフィール */}
          {tab === "profile" && (
            <ProfileTab u={u} showAmName={false} />
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
            {getStepLabel(u.completedStepCount, ROADMAP_STEPS.length)}
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
  if (u.role === "AM") return <Badge variant="outline" className="text-xs">アポインターマネージャー</Badge>;
  if (u.churned_at || u.isChurned) return <Badge className="bg-red-100 text-red-700 text-xs border-0">離脱</Badge>;
  if (u.paused_at)  return <Badge className="bg-amber-100 text-amber-700 text-xs border-0">休止中</Badge>;
  if (u.debuted)    return <Badge className="bg-green-100 text-green-700 text-xs border-0">デビュー済み</Badge>;
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
    // 離脱済みは除外（離脱データページへ）
    const appointers = users.filter((u) => u.role === "Appointer" && !u.churned_at);
    const ams        = users.filter((u) => u.role === "AM" || u.role === "AM_Sales");

    return (
      <PageLayout title="アポインター管理" role={role ?? "Sales"} userName={userName} userImage={image} userTeam={team}>
        <div className="space-y-6">

          {/* サマリー：2列レイアウト */}
          {summary && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 左列：ステータス別 */}
                  <div className="space-y-2">
                    {[
                      { icon: <Users className="w-3.5 h-3.5 text-gray-400" />, label: "アポインター総数", value: summary.total, color: "text-gray-800" },
                      { icon: <UserCheck className="w-3.5 h-3.5 text-green-500" />, label: "デビュー済み", value: summary.debuted, color: "text-green-600" },
                      { icon: <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />, label: "デビュー前", value: (summary.phaseCount ?? []).reduce((s, p) => s + p.count, 0), color: "text-indigo-600" },
                      { icon: <UserX className="w-3.5 h-3.5 text-red-400" />, label: "当月離脱", value: summary.churned, color: "text-red-500" },
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
                  {/* 右列：フェーズ別 */}
                  <div className="space-y-2">
                    {(summary.phaseCount ?? []).map(({ label, count }) => (
                      <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
                        <span className="text-xs text-gray-500">{label}</span>
                        <span className="text-lg font-bold text-indigo-600">{count}<span className="text-xs font-normal text-gray-400 ml-0.5">人</span></span>
                      </div>
                    ))}
                  </div>
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
                    <AppointerExpandRow
                      key={u.id}
                      user={u}
                      currentUserRole={role ?? ""}
                      onMemoSaved={(id, field, memo) => setUsers((prev) => prev.map((p) => p.id === id ? { ...p, [field]: memo } : p))}
                      onStatusChanged={(id, field, value) => setUsers((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p))}
                    />
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
                    <AMExpandRow
                      key={u.id}
                      user={u}
                      onMemoSaved={(id, memo) => setUsers((prev) => prev.map((p) => p.id === id ? { ...p, salesMemo: memo } : p))}
                      onStatusChanged={(id, field, value) => setUsers((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p))}
                    />
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
    // 離脱済みは離脱データページへ移動 → 通常リストから除外
    if (u.churned_at) return false;
    if (filterStatus === "デビュー済み") return u.debuted && !u.isChurned;
    if (filterStatus === "デビュー前") return !u.debuted;
    return true;
  });

  const appointers = filtered.filter((u) => u.role === "Appointer");
  const ams = filtered.filter((u) => u.role === "AM" || u.role === "AM_Sales");

  return (
    <PageLayout title="人事評価" role={role ?? "Admin"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {/* サマリー：2列レイアウト */}
        {summary && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 左列：ステータス別 */}
                <div className="space-y-2">
                  {[
                    { icon: <Users className="w-3.5 h-3.5 text-gray-400" />, label: "アポインター総数", value: summary.total, color: "text-gray-800" },
                    { icon: <UserCheck className="w-3.5 h-3.5 text-green-500" />, label: "デビュー済み", value: summary.debuted, color: "text-green-600" },
                    { icon: <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />, label: "デビュー前", value: (summary.phaseCount ?? []).reduce((s, p) => s + p.count, 0), color: "text-indigo-600" },
                    { icon: <UserX className="w-3.5 h-3.5 text-red-400" />, label: "当月離脱", value: summary.churned, color: "text-red-500" },
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
                {/* 右列：フェーズ別 */}
                <div className="space-y-2">
                  {(summary.phaseCount ?? []).map(({ label, count }) => (
                    <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-lg font-bold text-indigo-600">{count}<span className="text-xs font-normal text-gray-400 ml-0.5">人</span></span>
                    </div>
                  ))}
                </div>
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
            <p className="text-xs text-gray-400">名前をタップすると詳細が展開されます</p>
          </CardHeader>
          <CardContent className="p-0">
            {appointers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">該当するアポインターがいません</p>
            ) : (
              <div>
                {appointers.map((u) => (
                  <AppointerExpandRow
                    key={u.id}
                    user={u}
                    currentUserRole={role ?? ""}
                    onMemoSaved={(id, field, memo) => setUsers((prev) => prev.map((p) => p.id === id ? { ...p, [field]: memo } : p))}
                    onStatusChanged={(id, field, value) => setUsers((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p))}
                  />
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
              <p className="text-xs text-gray-400">名前をタップすると詳細が展開されます</p>
            </CardHeader>
            <CardContent className="p-0">
              <div>
                {ams.map((u) => (
                  <AMExpandRow
                    key={u.id}
                    user={u}
                    onMemoSaved={(id, memo) => setUsers((prev) => prev.map((p) => p.id === id ? { ...p, salesMemo: memo } : p))}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </PageLayout>
  );
}
