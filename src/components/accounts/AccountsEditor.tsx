"use client";

/**
 * AccountsEditor — 自分のアカウントURL・ステータスを編集するコンポーネント
 * （アポインター・AMのトップページ用）
 */

import { useEffect, useState } from "react";
import { Link2, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AccountStatus = "使用中（DM送信）" | "使用中（運用専用）" | "使用不可" | "休止中";

const STATUS_OPTIONS: AccountStatus[] = [
  "使用中（DM送信）",
  "使用中（運用専用）",
  "使用不可",
  "休止中",
];

const STATUS_STYLE: Record<AccountStatus, string> = {
  "使用中（DM送信）":   "bg-emerald-100 text-emerald-700",
  "使用中（運用専用）": "bg-sky-100 text-sky-700",
  "使用不可":           "bg-red-100 text-red-600",
  "休止中":             "bg-amber-100 text-amber-700",
};

interface Account {
  slot: number;
  url: string;
  status: AccountStatus;
}

const MAX_ACCOUNTS = 10;

export default function AccountsEditor({ userId }: { userId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/accounts/${userId}`)
      .then((r) => r.ok ? r.json() : { accounts: [] })
      .then(({ accounts: rows }) => {
        // slot 1〜10 の配列に正規化（DBになければ空欄）
        const map = new Map<number, Account>(
          (rows as Account[]).map((a) => [a.slot, a])
        );
        // 保存済みのスロットのみ表示（+1追加スロット）
        const filled = Array.from(map.values());
        const next = filled.length < MAX_ACCOUNTS
          ? [...filled, { slot: filled.length + 1, url: "", status: "使用中（DM送信）" as AccountStatus }]
          : filled;
        setAccounts(next.sort((a, b) => a.slot - b.slot));
      })
      .catch(() => setAccounts([{ slot: 1, url: "", status: "使用中（DM送信）" }]))
      .finally(() => setLoading(false));
  }, [userId]);

  function updateAccount(slot: number, field: keyof Account, value: string) {
    setAccounts((prev) =>
      prev.map((a) => a.slot === slot ? { ...a, [field]: value } : a)
    );
    setSaved(false);
  }

  function addSlot() {
    const maxSlot = accounts.reduce((m, a) => Math.max(m, a.slot), 0);
    if (maxSlot >= MAX_ACCOUNTS) return;
    setAccounts((prev) => [...prev, { slot: maxSlot + 1, url: "", status: "使用中（DM送信）" }]);
  }

  function removeSlot(slot: number) {
    setAccounts((prev) => prev.filter((a) => a.slot !== slot));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/accounts/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      });
      if (res.ok) {
        const { accounts: updated } = await res.json();
        const map = new Map<number, Account>(
          (updated as Account[]).map((a) => [a.slot, a])
        );
        const filled = Array.from(map.values());
        const next = filled.length < MAX_ACCOUNTS
          ? [...filled, { slot: filled.length + 1, url: "", status: "使用中（DM送信）" as AccountStatus }]
          : filled;
        setAccounts(next.sort((a, b) => a.slot - b.slot));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="bg-white rounded-2xl border border-amber-100 p-4">
      <p className="text-xs text-gray-400 text-center py-2">読み込み中...</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-pink-500" />
          <p className="text-sm font-bold text-gray-800">使用中のアカウント</p>
        </div>
        <span className="text-xs text-gray-400">{accounts.filter(a => a.url).length} / {MAX_ACCOUNTS}</span>
      </div>

      {/* アカウント行 */}
      <div className="space-y-2">
        {accounts.map((acc) => (
          <div key={acc.slot} className="flex items-center gap-2">
            {/* スロット番号 */}
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0">
              {acc.slot}
            </span>

            {/* URL入力 */}
            <input
              type="url"
              value={acc.url}
              onChange={(e) => updateAccount(acc.slot, "url", e.target.value)}
              placeholder="https://www.instagram.com/..."
              className="flex-1 min-w-0 text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-300 bg-white"
            />

            {/* ステータスプルダウン */}
            <div className="shrink-0 w-36">
              <Select
                value={acc.status}
                onValueChange={(v) => updateAccount(acc.slot, "status", v ?? "使用中（DM送信）")}
              >
                <SelectTrigger className="h-8 text-[11px] rounded-lg border-gray-200 px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 削除ボタン */}
            <button
              onClick={() => removeSlot(acc.slot)}
              className="shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* 追加ボタン */}
      {accounts.length < MAX_ACCOUNTS && (
        <button
          onClick={addSlot}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-amber-200 text-xs text-amber-600 hover:bg-amber-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          アカウントを追加
        </button>
      )}

      {/* 保存ボタン */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" /> 保存しました
          </span>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-all"
          style={{ background: "linear-gradient(135deg, #cfa340, #e8c060)" }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
