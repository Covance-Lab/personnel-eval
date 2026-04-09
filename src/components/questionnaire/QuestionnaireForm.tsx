"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentMonthKey, getQuestionnaireDeadlineForMonthKey, getMonthlyAnswerForUser, upsertMonthlyAnswerForUser } from "@/lib/questionnaireStorage";
import type { QuestionnaireMonthKey } from "@/types/questionnaire";
import type { MonthlyQuestionnaireAnswer } from "@/types/questionnaire";

export default function QuestionnaireForm({ userId }: { userId: string }) {
  const router = useRouter();
  const now = new Date();
  const monthKey: QuestionnaireMonthKey = getCurrentMonthKey(now);
  const deadline = getQuestionnaireDeadlineForMonthKey(monthKey);

  const existing = getMonthlyAnswerForUser(userId, monthKey);
  const isSubmitted = Boolean(existing);

  const [selfCheck, setSelfCheck] = useState<string>(existing?.answers.selfCheck ?? "");
  const [nextAction, setNextAction] = useState<string>(existing?.answers.nextAction ?? "");
  const [rating, setRating] = useState<MonthlyQuestionnaireAnswer["answers"]["rating"]>(existing?.answers.rating ?? 3);
  const [saving, setSaving] = useState(false);

  const onSubmit = () => {
    if (isSubmitted) return;
    setSaving(true);
    try {
      upsertMonthlyAnswerForUser({
        userId,
        monthKey,
        answer: {
          selfCheck: selfCheck.trim() || undefined,
          nextAction: nextAction.trim() || undefined,
          rating: rating ?? undefined,
        },
      });
      router.replace("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => router.replace("/dashboard")}>
            ダッシュボードへ戻る
          </Button>
          <p className="text-xs text-gray-500">
            {monthKey.replace("-", "年") /* fallback */}
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">月次評価アンケート</h1>
            <p className="text-sm text-gray-600">
              提出期限: {deadline.toLocaleString("ja-JP").slice(0, -3)}
            </p>
          </div>

          {isSubmitted && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
              既に回答済みです。
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">今月の自己チェック</p>
            <Input
              value={selfCheck}
              disabled={isSubmitted}
              onChange={(e) => setSelfCheck(e.target.value)}
              placeholder="例: ターゲット選定と投稿頻度を改善できた..."
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">来月の次アクション</p>
            <textarea
              className="w-full min-h-[120px] rounded-lg border bg-white p-2 text-sm"
              value={nextAction}
              disabled={isSubmitted}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="例: リール投稿のテーマを3つに絞り、毎週1本作る..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">今月の自己評価（1〜5）</p>
              <Select
                value={String(rating ?? 3)}
                onValueChange={(v) =>
                  setRating((v ? Number(v) : 3) as 1 | 2 | 3 | 4 | 5)
                }
                disabled={isSubmitted}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">提出状況</p>
              <div className="text-sm text-gray-700">
                {isSubmitted ? "提出済み" : "未提出"}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.replace("/dashboard")}>
              キャンセル
            </Button>
            <Button onClick={onSubmit} disabled={isSubmitted || saving}>
              {saving ? "送信中..." : "提出する"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

