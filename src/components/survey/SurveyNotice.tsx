"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface SurveyNoticeProps {
  userId: string;
}

interface SurveyGroup {
  amId: string;
  amName: string;
  fullySubmitted: boolean;
}

interface SurveyStatus {
  role: string;
  fullySubmitted: boolean;
  inactive?: boolean;
  // 営業マンの場合
  groups?: SurveyGroup[];
}

function NoticeCard({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <Card className="p-4 border border-red-300 bg-red-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Bell className="w-5 h-5 text-red-500 mt-0.5 shrink-0 animate-pulse" />
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-red-700">{title}</p>
            <p className="text-xs text-gray-600">ご回答をお願いします（所要時間約4分）</p>
            <p className="text-xs text-red-600 font-medium">提出しないと評価が完了しません！</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onClick}
          className="shrink-0 bg-red-600 hover:bg-red-700"
        >
          回答する
        </Button>
      </div>
    </Card>
  );
}

export default function SurveyNotice({ userId }: SurveyNoticeProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SurveyStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const now = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    fetch(`/api/survey?year=${year}&month=${month}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setStatus(d);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  if (!loaded || !status) return null;
  if (status.inactive || status.fullySubmitted) return null;

  // 営業マン: AMごとのグループバナー
  if (status.role === "Sales" && status.groups) {
    const pendingGroups = status.groups.filter((g) => !g.fullySubmitted);
    if (pendingGroups.length === 0) return null;

    return (
      <div className="space-y-3">
        {pendingGroups.map((group) => (
          <NoticeCard
            key={group.amId}
            title={`${group.amName}チームの月次アンケートが届いています`}
            onClick={() => router.push(`/survey?amId=${group.amId}`)}
          />
        ))}
      </div>
    );
  }

  // その他ロール（Appointer / AM）: 単一バナー
  return (
    <NoticeCard
      title="月次アンケートが届いています"
      onClick={() => router.push("/survey")}
    />
  );
}
