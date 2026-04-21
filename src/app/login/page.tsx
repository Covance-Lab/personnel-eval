"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { MessageCircle, FlaskConical, ChevronDown, ChevronUp } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  Admin:     "bg-purple-100 text-purple-800",
  AM:        "bg-blue-100 text-blue-800",
  Sales:     "bg-green-100 text-green-800",
  Appointer: "bg-indigo-100 text-indigo-800",
  Bridge:    "bg-orange-100 text-orange-800",
  Closer:    "bg-pink-100 text-pink-800",
};

interface TestUser {
  id: string;
  nickname?: string;
  name?: string;
  line_name?: string;
  role: string;
  team?: string;
}

function TestLoginSection({ callbackUrl }: { callbackUrl: string }) {
  const [users, setUsers]         = useState<TestUser[]>([]);
  const [testMode, setTestMode]   = useState(false);
  const [open, setOpen]           = useState(true);
  const [signingIn, setSigningIn] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/test-users")
      .then((r) => {
        if (!r.ok) return null;
        setTestMode(true);
        return r.json();
      })
      .then((d) => { if (d) setUsers(d.users ?? []); })
      .catch(() => {});
  }, []);

  if (!testMode) return null;

  async function handleLogin(userId: string) {
    setSigningIn(userId);
    await signIn("credentials", { userId, callbackUrl });
  }

  const ORDER = ["Admin", "Sales", "AM", "Appointer", "Bridge", "Closer"];
  const grouped = ORDER.reduce<Record<string, TestUser[]>>((acc, role) => {
    const list = users.filter((u) => u.role === role);
    if (list.length) acc[role] = list;
    return acc;
  }, {});

  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <button
        className="w-full flex items-center justify-between text-xs text-amber-600 font-semibold mb-3"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" /> テストログイン
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="space-y-3">
          {users.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">
              テストユーザーがいません
            </p>
          ) : (
            Object.entries(grouped).map(([role, list]) => (
              <div key={role}>
                <p className="text-xs font-medium text-gray-400 mb-1.5">{role}</p>
                <div className="space-y-1.5">
                  {list.map((u) => {
                    const displayName = u.nickname ?? u.name ?? u.line_name ?? u.id;
                    return (
                      <button
                        key={u.id}
                        disabled={signingIn !== null}
                        onClick={() => handleLogin(u.id)}
                        className="w-full flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-left hover:bg-gray-100 transition-colors disabled:opacity-60"
                      >
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700"}`}>
                          {role}
                        </span>
                        <span className="text-sm font-medium text-gray-800 flex-1">{displayName}</span>
                        {u.team && <span className="text-xs text-gray-400">{u.team}</span>}
                        {signingIn === u.id && <span className="text-xs text-indigo-400">ログイン中...</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [isLoading, setIsLoading] = useState(false);

  async function handleLineLogin() {
    setIsLoading(true);
    await signIn("line", { callbackUrl });
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] flex flex-col items-center justify-center p-5">

      {/* カード */}
      <div className="w-full max-w-[360px] bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* ── ヒーローセクション（パンダ） ── */}
        <div
          className="relative w-full flex items-center justify-center"
          style={{ backgroundColor: "#C9963A", height: 220 }}
        >
          {/* 背景の装飾円 */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-white rounded-t-3xl" />

          {/* パンダ画像 */}
          <div className="relative z-10 w-44 h-44">
            <Image
              src="/panda.png"
              alt="パンダ"
              fill
              className="object-contain drop-shadow-xl"
              priority
            />
          </div>
        </div>

        {/* ── ログインセクション ── */}
        <div className="px-7 pt-2 pb-8">

          {/* タイトル */}
          <div className="text-center mb-7">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              アポインター管理
            </h1>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              評価・離脱防止システム
            </p>

            {/* アクセントライン */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <div className="w-6 h-0.5 rounded-full bg-indigo-200" />
              <div className="w-10 h-0.5 rounded-full bg-indigo-500" />
              <div className="w-6 h-0.5 rounded-full bg-indigo-200" />
            </div>
          </div>

          {/* LINEログインボタン */}
          <button
            onClick={handleLineLogin}
            disabled={isLoading}
            className="w-full h-[52px] rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-green-200"
            style={{
              background: isLoading
                ? "#05b34d"
                : "linear-gradient(135deg, #06C755 0%, #04a845 100%)",
            }}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                ログイン中...
              </>
            ) : (
              <>
                <MessageCircle className="w-5 h-5 fill-white" />
                LINEでログイン
              </>
            )}
          </button>

          {/* 注記 */}
          <p className="text-[11px] text-center text-gray-400 mt-4 leading-relaxed">
            LINEアカウントでのみログインできます
            <br />
            アクセス権限はAdminが管理します
          </p>

          {/* テストログイン（開発環境のみ） */}
          <TestLoginSection callbackUrl={callbackUrl} />
        </div>
      </div>

      {/* フッター */}
      <p className="mt-6 text-xs text-gray-400">
        © 2025 Appointer Management System
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
