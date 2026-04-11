"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface SurveyNoticeProps {
  userId: string;
}

export default function SurveyNotice({ userId }: SurveyNoticeProps) {
  const router = useRouter();
  // デフォルトtrue = 最初から表示、API確認後に非表示
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const now = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    fetch(`/api/survey?year=${year}&month=${month}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        // inactive（期間外）または fullySubmitted（提出済み）なら非表示
        if (d?.inactive || d?.fullySubmitted === true) {
          setVisible(false);
        }
      })
      .catch(() => {
        // API失敗時はそのまま表示継続
      });
  }, [userId]);

  if (!visible) return null;

  return (
    <Card className="p-4 border border-red-300 bg-red-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Bell className="w-5 h-5 text-red-500 mt-0.5 shrink-0 animate-pulse" />
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-red-700">
              月次アンケートが届いています
            </p>
            <p className="text-xs text-gray-600">
              ご回答をお願いします（所要時間約4分）
            </p>
            <p className="text-xs text-red-600 font-medium">
              提出しないと評価が完了しません！
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => router.push("/survey")}
          className="shrink-0 bg-red-600 hover:bg-red-700"
        >
          回答する
        </Button>
      </div>
    </Card>
  );
}
