"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, MessageCircle } from "lucide-react";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 shadow-xl">
        {/* ロゴ */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-md">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">アポインター管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">評価・離脱防止システム</p>
          </div>
        </div>

        {/* ログインボタン */}
        <Button
          className="w-full h-12 text-base font-semibold gap-3 bg-[#06C755] hover:bg-[#05b34d] text-white shadow-md"
          onClick={() =>
            signIn("line", { callbackUrl })
          }
        >
          <MessageCircle className="w-5 h-5" />
          LINEでログイン
        </Button>

        <p className="text-xs text-center text-gray-400 mt-6">
          このシステムはLINEアカウントでのみログインできます。
          <br />
          アクセス権限はAdminが管理します。
        </p>
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
