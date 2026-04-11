"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLE_TOP: Record<string, string> = {
  Admin:     "/overview",
  Sales:     "/sales",
  AM:        "/am",
  Appointer: "/appointer",
  Bridge:    "/am",
  Closer:    "/am",
};

export default function SurveyDonePage() {
  const router = useRouter();
  const { data: session } = useSession();

  const role = session?.user?.role ?? "Appointer";
  const topPage = ROLE_TOP[role] ?? "/dashboard";
  const name = session?.user?.nickname ?? session?.user?.name ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">

        {/* アイコン */}
        <div className="relative inline-flex">
          <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-14 h-14 text-indigo-600" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-8 h-8 text-amber-400" />
        </div>

        {/* メッセージ */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            提出完了！
          </h1>
          {name && (
            <p className="text-gray-600">
              {name}さん、ありがとうございます😊
            </p>
          )}
          <p className="text-sm text-gray-500 leading-relaxed">
            アンケートへのご協力ありがとうございました。<br />
            いただいた回答をもとに、より良い環境づくりに活かしていきます。<br />
            引き続き一緒に事業を盛り上げていきましょう！
          </p>
        </div>

        {/* ボタン */}
        <Button
          className="w-full"
          onClick={() => router.replace(topPage)}
        >
          トップページに戻る
        </Button>

      </div>
    </div>
  );
}
