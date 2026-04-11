"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, MessageCircle, FlaskConical, ChevronDown, ChevronUp } from "lucide-react";

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
    // APIが 200 を返した場合のみテストモードとみなす
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
    <div className="mt-4 border-t pt-4">
      <button
        className="w-full flex items-center justify-between text-xs text-amber-700 font-semibold mb-2"
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
              テストユーザーがいません<br />
              <span className="text-gray-300">（管理者画面から追加できます）</span>
            </p>
          ) : (
            Object.entries(grouped).map(([role, list]) => (
              <div key={role}>
                <p className="text-xs font-medium text-gray-500 mb-1.5">{role}</p>
                <div className="space-y-1.5">
                  {list.map((u) => {
                    const displayName = u.nickname ?? u.name ?? u.line_name ?? u.id;
                    return (
                      <button
                        key={u.id}
                        disabled={signingIn !== null}
                        onClick={() => handleLogin(u.id)}
                        className="w-full flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2.5 text-left hover:bg-gray-50 transition-colors disabled:opacity-60"
                      >
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700"}`}>
                          {role}
                        </span>
                        <span className="text-sm font-medium text-gray-800 flex-1">{displayName}</span>
                        {u.team && <span className="text-xs text-gray-400">{u.team}</span>}
                        {signingIn === u.id && <span className="text-xs text-gray-400">ログイン中...</span>}
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-md">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">アポインター管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">評価・離脱防止システム</p>
          </div>
        </div>

        <Button
          className="w-full h-12 text-base font-semibold gap-3 bg-[#06C755] hover:bg-[#05b34d] text-white shadow-md"
          onClick={() => signIn("line", { callbackUrl })}
        >
          <MessageCircle className="w-5 h-5" />
          LINEでログイン
        </Button>

        <p className="text-xs text-center text-gray-400 mt-4">
          このシステムはLINEアカウントでのみログインできます。<br />
          アクセス権限はAdminが管理します。
        </p>

        {/* APIが TEST_MODE=true を返した場合のみ表示 */}
        <TestLoginSection callbackUrl={callbackUrl} />
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">読み込み中...</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
