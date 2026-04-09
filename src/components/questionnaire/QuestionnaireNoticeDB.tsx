"use client";

/**
 * QuestionnaireNoticeDB — API (Supabase) バックエンド版
 * アンケート提出状況を /api/questionnaire から取得する
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentMonthKey, getQuestionnaireDeadlineForMonthKey } from "@/lib/questionnaireStorage";

interface QuestionnaireStatus {
  submitted: boolean;
  submittedAt?: string;
}

export default function QuestionnaireNoticeDB({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<QuestionnaireStatus | null>(null);

  const now       = new Date();
  const monthKey  = getCurrentMonthKey(now);
  const deadline  = getQuestionnaireDeadlineForMonthKey(monthKey);
  const msLeft    = deadline.getTime() - now.getTime();
  const isOverdue = msLeft <= 0;
  const isDueSoon = !isOverdue && msLeft <= 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/questionnaire?userId=${userId}&monthKey=${monthKey}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) setStatus({ submitted: d.submitted, submittedAt: d.submittedAt });
      })
      .catch(() => {});
  }, [userId, monthKey]);

  const isSubmitted = status?.submitted ?? false;

  return (
    <Card className={`p-4 ${isDueSoon || isOverdue ? "border border-red-200 bg-red-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">月次評価アンケート</p>
          <p className="text-xs text-gray-600">
            期限: {deadline.getFullYear()}年{deadline.getMonth() + 1}月{deadline.getDate()}日 23:59
          </p>
          <p className={`text-xs ${isSubmitted ? "text-green-700" : isDueSoon || isOverdue ? "text-red-700" : "text-gray-500"}`}>
            {status === null
              ? "確認中..."
              : isSubmitted
              ? "回答済みです"
              : isOverdue
              ? "未提出（期限超過）"
              : isDueSoon
              ? "締切1日前：未提出"
              : "未提出"}
          </p>
        </div>
        <div className="shrink-0">
          {isSubmitted ? (
            <Button variant="outline" disabled>提出済み</Button>
          ) : (
            <Button onClick={() => router.push("/questionnaire")}>回答する</Button>
          )}
        </div>
      </div>
    </Card>
  );
}
