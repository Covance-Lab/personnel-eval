"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QuestionnaireMonthKey } from "@/types/questionnaire";
import { getQuestionnaireDeadlineForMonthKey, getCurrentMonthKey, getMonthlyAnswerForUser } from "@/lib/questionnaireStorage";

export default function QuestionnaireNotice({
  userId,
}: {
  userId: string;
}) {
  const router = useRouter();
  const now = new Date();
  const monthKey: QuestionnaireMonthKey = getCurrentMonthKey(now);
  const deadline = getQuestionnaireDeadlineForMonthKey(monthKey);

  const submission = getMonthlyAnswerForUser(userId, monthKey);

  const isSubmitted = Boolean(submission);
  const msToDeadline = deadline.getTime() - now.getTime();
  const isDueSoon = !isSubmitted && msToDeadline > 0 && msToDeadline <= 24 * 60 * 60 * 1000;
  const isOverdue = !isSubmitted && msToDeadline <= 0;

  return (
    <Card className={`p-4 ${isDueSoon || isOverdue ? "border border-red-200 bg-red-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">月次評価アンケート回答</p>
          <p className="text-xs text-gray-600">
            期限: {deadline.getFullYear()}年{deadline.getMonth() + 1}月{deadline.getDate()}日 23:59
          </p>
          <p className={`text-xs ${isSubmitted ? "text-green-700" : isDueSoon || isOverdue ? "text-red-700" : "text-gray-500"}`}>
            {isSubmitted ? "回答済みです" : isOverdue ? "未提出（期限超過）" : isDueSoon ? "締切1日前：未提出" : "未提出"}
          </p>
        </div>
        <div className="flex-shrink-0">
          {isSubmitted ? (
            <Button variant="outline" disabled>
              提出済み
            </Button>
          ) : (
            <Button onClick={() => router.replace("/questionnaire")}>
              回答する
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

