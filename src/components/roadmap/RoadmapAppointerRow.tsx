"use client";

import { useMemo, useState } from "react";
import type { AppointerRoadmap, RoadmapStepId } from "@/types/roadmap";
import { ROADMAP_STEPS } from "@/types/roadmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { UserAccount } from "@/types/user";
import { fromDatetimeLocalValue, toDatetimeLocalValue, formatRemainingTime } from "@/lib/time";
import { isOverdueByRegisteredAt, getPercentFromCompletedStepCount } from "@/lib/roadmapUtils";

function getActiveStepIdForCompletedCount(completedStepCount: number): RoadmapStepId | null {
  if (completedStepCount >= ROADMAP_STEPS.length) return null;
  return ROADMAP_STEPS[completedStepCount]?.id ?? null;
}

export default function RoadmapAppointerRow({
  label,
  roadmap,
  readOnly,
  onUpsertRoadmap,
}: {
  appointer: UserAccount;
  label: string;
  roadmap: AppointerRoadmap;
  readOnly: boolean;
  onUpsertRoadmap: (next: AppointerRoadmap) => void;
}) {
  const [draftCompletedCount, setDraftCompletedCount] = useState<number>(roadmap.completedStepCount);
  const [deadlineLocal, setDeadlineLocal] = useState<string>(() => {
    const activeStepId = getActiveStepIdForCompletedCount(draftCompletedCount);
    if (!activeStepId) return "";
    const iso = roadmap.deadlinesByStepId[activeStepId] ?? "";
    return iso ? toDatetimeLocalValue(iso) : "";
  });
  const [draftMemo, setDraftMemo] = useState<string>(roadmap.amMemo ?? "");

  const activeStepId = useMemo<RoadmapStepId | null>(() => {
    if (draftCompletedCount >= ROADMAP_STEPS.length) return null;
    return ROADMAP_STEPS[draftCompletedCount]?.id ?? null;
  }, [draftCompletedCount]);

  const progressPct = getPercentFromCompletedStepCount(roadmap.completedStepCount);
  const showOverdue = isOverdueByRegisteredAt(roadmap, new Date());

  const activeDeadlineIso = activeStepId ? roadmap.deadlinesByStepId[activeStepId] ?? null : null;
  const nextDeadlineInfo = useMemo(() => {
    if (!activeDeadlineIso) return null;
    return formatRemainingTime(activeDeadlineIso, new Date());
  }, [activeDeadlineIso]);

  const onSave = () => {
    const next: AppointerRoadmap = {
      ...roadmap,
      completedStepCount: Math.max(0, Math.min(ROADMAP_STEPS.length, draftCompletedCount)),
      amMemo: draftMemo,
      deadlinesByStepId: { ...roadmap.deadlinesByStepId },
    };

    if (next.completedStepCount >= ROADMAP_STEPS.length) {
      // 完了の場合は期限をクリア
      next.deadlinesByStepId = {};
    } else if (activeStepId) {
      const maybeIso = fromDatetimeLocalValue(deadlineLocal);
      if (maybeIso) next.deadlinesByStepId[activeStepId] = maybeIso;
      else delete next.deadlinesByStepId[activeStepId];
    }

    onUpsertRoadmap(next);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{label}</p>
          {roadmap.completedStepCount >= ROADMAP_STEPS.length ? (
            <Badge className="bg-green-100 text-green-700 border border-green-200">デビュー完了</Badge>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              現在: ステップ {roadmap.completedStepCount + 1}（次の完了: {ROADMAP_STEPS[roadmap.completedStepCount]?.label}）
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showOverdue && roadmap.completedStepCount < ROADMAP_STEPS.length && (
            <Badge className="bg-red-100 text-red-700 border border-red-200">期限超過</Badge>
          )}
        </div>
      </div>

      <Progress value={progressPct} className="mt-1" />

      <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
        <span>デビューまで: {progressPct.toFixed(1)}%</span>
        <span>
          {nextDeadlineInfo ? (
            nextDeadlineInfo.isOverdue ? (
              <span className="text-red-600">期限: {nextDeadlineInfo.label}</span>
            ) : (
              <span>期限: {nextDeadlineInfo.label}</span>
            )
          ) : (
            "期限: 未設定"
          )}
        </span>
      </div>

      {!readOnly && (
        <div className="space-y-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-700 mb-1">現在のステップ（更新）</p>
              <select
                className="h-9 w-full rounded-lg border bg-white px-2 text-sm"
                value={String(draftCompletedCount)}
                onChange={(e) => {
                  const nextCount = Number(e.target.value);
                  setDraftCompletedCount(nextCount);
                  const nextActiveStepId = getActiveStepIdForCompletedCount(nextCount);
                  const iso = nextActiveStepId ? roadmap.deadlinesByStepId[nextActiveStepId] ?? "" : "";
                  setDeadlineLocal(iso ? toDatetimeLocalValue(iso) : "");
                }}
              >
                {ROADMAP_STEPS.map((s, idx) => (
                  <option key={s.id} value={String(idx)}>
                    ステップ {idx + 1}
                  </option>
                ))}
                <option value={String(ROADMAP_STEPS.length)}>デビュー完了</option>
              </select>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-700 mb-1">次の完了期限</p>
              <input
                type="datetime-local"
                className="h-9 w-full rounded-lg border bg-white px-2 text-sm"
                value={deadlineLocal}
                onChange={(e) => setDeadlineLocal(e.target.value)}
                disabled={draftCompletedCount >= ROADMAP_STEPS.length}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">AMメモ（自由記述）</p>
            <textarea
              className="w-full min-h-[90px] rounded-lg border bg-white p-2 text-sm"
              value={draftMemo}
              onChange={(e) => setDraftMemo(e.target.value)}
              placeholder="例: ターゲット選定に苦戦中..."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} size="sm">
              更新
            </Button>
          </div>
        </div>
      )}

      {readOnly && (
        <div className="text-xs text-gray-500">
          {roadmap.completedStepCount < ROADMAP_STEPS.length ? (
            <span>
              次の期限:{" "}
              {activeDeadlineIso ? (
                <span>{formatRemainingTime(activeDeadlineIso, new Date()).label}</span>
              ) : (
                "未設定"
              )}
            </span>
          ) : (
            <span>期限はありません</span>
          )}
        </div>
      )}
    </Card>
  );
}

