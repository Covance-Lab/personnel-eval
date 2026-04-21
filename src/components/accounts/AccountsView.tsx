"use client";

/**
 * AccountsView — 他人のアカウント一覧を閲覧するコンポーネント
 * （HR・アポインター管理ページの「アカウント」タブ用）
 */

import { useEffect, useState } from "react";
import { Link2, ExternalLink } from "lucide-react";

type AccountStatus = "使用中（DM送信）" | "使用中（運用専用）" | "使用不可" | "休止中";

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "使用中（DM送信）":   { bg: "#d1fae5", text: "#065f46" },
  "使用中（運用専用）": { bg: "#e0f2fe", text: "#0369a1" },
  "使用不可":           { bg: "#fee2e2", text: "#991b1b" },
  "休止中":             { bg: "#fef3c7", text: "#92400e" },
};

interface Account {
  slot: number;
  url: string;
  status: AccountStatus;
}

export default function AccountsView({ userId }: { userId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/accounts/${userId}`)
      .then((r) => r.ok ? r.json() : { accounts: [] })
      .then(({ accounts: rows }) => setAccounts(rows ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="text-xs text-gray-400 text-center py-4">読み込み中...</p>;

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-gray-300">
        <Link2 className="w-8 h-8" />
        <p className="text-xs">アカウントが登録されていません</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {accounts.map((acc) => {
        const style = STATUS_STYLE[acc.status] ?? { bg: "#f3f4f6", text: "#374151" };
        // URLからアカウント名を抽出（表示用）
        let displayUrl = acc.url;
        try {
          const u = new URL(acc.url);
          displayUrl = u.hostname + u.pathname.replace(/\/$/, "");
        } catch {
          // そのまま表示
        }

        return (
          <div
            key={acc.slot}
            className="flex items-center gap-2.5 bg-white rounded-xl border border-gray-100 px-3 py-2.5"
          >
            {/* 番号 */}
            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
              {acc.slot}
            </span>

            {/* Instagram アイコン */}
            <Link2 className="w-4 h-4 text-pink-400 shrink-0" />

            {/* URL リンク */}
            <a
              href={acc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0 text-xs text-blue-600 hover:underline flex items-center gap-1 truncate"
            >
              <span className="truncate">{displayUrl}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>

            {/* ステータスバッジ */}
            <span
              className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: style.bg, color: style.text }}
            >
              {acc.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
