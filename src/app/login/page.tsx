"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { MessageCircle, FlaskConical, ChevronDown, ChevronUp } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  Admin:     "bg-violet-100 text-violet-800",
  AM:        "bg-teal-100 text-teal-800",
  Sales:     "bg-emerald-100 text-emerald-800",
  Appointer: "bg-amber-100 text-amber-800",
  Bridge:    "bg-sky-100 text-sky-800",
  Closer:    "bg-rose-100 text-rose-800",
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
      .then((r) => { if (!r.ok) return null; setTestMode(true); return r.json(); })
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
    <div className="mt-5 border-t border-[#f0e8d6] pt-5">
      <button
        className="w-full flex items-center justify-between text-xs text-amber-700 font-semibold mb-3"
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
            <p className="text-xs text-amber-700/50 text-center py-2">テストユーザーがいません</p>
          ) : (
            Object.entries(grouped).map(([role, list]) => (
              <div key={role}>
                <p className="text-xs font-medium text-amber-900/40 mb-1.5">{role}</p>
                <div className="space-y-1.5">
                  {list.map((u) => {
                    const displayName = u.nickname ?? u.name ?? u.line_name ?? u.id;
                    return (
                      <button
                        key={u.id}
                        disabled={signingIn !== null}
                        onClick={() => handleLogin(u.id)}
                        className="w-full flex items-center gap-2.5 rounded-xl border border-amber-100 bg-white/60 px-3 py-2.5 text-left hover:bg-white transition-colors disabled:opacity-60"
                      >
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700"}`}>
                          {role}
                        </span>
                        <span className="text-sm font-medium text-gray-800 flex-1">{displayName}</span>
                        {u.team && <span className="text-xs text-gray-400">{u.team}</span>}
                        {signingIn === u.id && <span className="text-xs text-amber-500">ログイン中...</span>}
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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: "linear-gradient(160deg, #fff9ec 0%, #fef0cc 50%, #fde8a8 100%)" }}
    >
      {/* カード */}
      <div className="w-full max-w-[360px] bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl shadow-amber-200/60 overflow-hidden border border-amber-100">

        {/* ── パンダヒーロー ── */}
        <div className="relative flex items-end justify-center pt-8 pb-0"
          style={{ background: "#cfa340" }}>
          {/* 背景の装飾グロー */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          {/* パンダ */}
          <div className="relative z-10 w-36 h-36 drop-shadow-2xl">
            <Image
              src="/panda.png"
              alt="パンダ"
              fill
              className="object-contain object-bottom"
              priority
            />
          </div>
        </div>

        {/* ── ログインセクション ── */}
        <div className="px-7 pt-5 pb-8" style={{ background: "#fff9ec" }}>

          {/* タイトル */}
          <div className="text-center mb-7">
            <p className="text-[11px] font-semibold text-amber-700/50 tracking-widest mb-1">株式会社Covance</p>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-snug">
              集客管理ツール
            </h1>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <div className="w-5 h-0.5 rounded-full bg-amber-200" />
              <div className="w-10 h-[3px] rounded-full bg-[#cfa340]" />
              <div className="w-5 h-0.5 rounded-full bg-amber-200" />
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

          <p className="text-[11px] text-center text-amber-900/40 mt-4 leading-relaxed">
            LINEアカウントでのみログインできます
            <br />
            アクセス権限はAdminが管理します
          </p>

          <TestLoginSection callbackUrl={callbackUrl} />
        </div>
      </div>

      <p className="mt-6 text-xs text-amber-800/40">© 2025 Appointer Management System</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#fff9ec" }}>
          <div className="w-8 h-8 border-2 border-[#cfa340] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
