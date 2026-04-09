"use client";

/**
 * RoadmapAppointerRowDB — API (Supabase) バックエンド版
 * 保存時に /api/roadmap/[userId] PATCH を呼ぶ
 */

import { useMemo, useState } from "react";
import type { AppointerRoadmap, RoadmapStepId } from "@/types/roadmap";
import { ROADMAP_STEPS } from "@/types/roadmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fromDatetimeLocalValue, toDatetimeLocalValue, formatRemainingTime } from "@/lib/time";
import { isOverdueByRegisteredAt, getPercentFromCompletedStepCount } from "@/lib/roadmapUtils";

function getActiveStepId(count: number): RoadmapStepId | null {
  if (count >= ROADMAP_STEPS.length) return null;
  return ROADMAP_STEPS[count]?.id ?? null;
}

export default function RoadmapAppointerRowDB({
  userId,
  label,
  roadmap,
  readOnly,
  onUpdated,
}: {
  userId: string;
  label: string;
  roadmap: AppointerRoadmap;
  readOnly: boolean;
  onUpdated: (next: AppointerRoadmap) => void;
}) {
  const [draftCount, setDraftCount] = useState(roadmap.completedStepCount);
  const [deadlineLocal, setDeadlineLocal] = useState(() => {
    const sid = getActiveStepId(roadmap.completedStepCount);
    const iso = sid ? roadmap.deadlinesByStepId[sid] ?? "" : "";
    return iso ? toDatetimeLocalValue(iso) : "";
  });
  const [draftMemo, setDraftMemo] = useState(roadmap.amMemo ?? "");
  const [saving, setSaving] = useState(false);

  const activeStepId = useMemo(() => getActiveStepId(draftCount), [draftCount]);
  const progressPct  = getPercentFromCompletedStepCount(roadmap.completedStepCount);
  const showOverdue  = isOverdueByRegisteredAt(roadmap, new Date());
  const activeDeadlineIso = activeStepId ? roadmap.deadlinesByStepId[activeStepId] ?? null : null;
  const nextDeadlineInfo  = useMemo(() => {
    if (!activeDeadlineIso) return null;
    return formatRemainingTime(activeDeadlineIso, new Date());
  }, [activeDeadlineIso]);

  async function handleSave() {
    setSaving(true);
    const deadlinesByStepId = { ...roadmap.deadlinesByStepId };
    if (draftCount >= ROADMAP_STEPS.length) {
      Object.keys(deadlinesByStepId).forEach((k) => delete deadlinesByStepId[k as RoadmapStepId]);
    } else if (activeStepId) {
      const iso = fromDatetimeLocalValue(deadlineLocal);
      if (iso) deadlinesByStepId[activeStepId] = iso;
      else delete deadlinesByStepId[activeStepId];
    }

    try {
      const res = await fetch(`/api/roadmap/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed_step_count:  Math.max(0, Math.min(ROADMAP_STEPS.length, draftCount)),
          deadlines_by_step_id:  deadlinesByStepId,
          am_memo:               draftMemo,
        }),
      });
      if (res.ok) {
        const { roadmap: updated } = await res.json();
        onUpdated({
          userId,
          registeredAt:       updated.registered_at,
          completedStepCount: updated.completed_step_count,
          deadlinesByStepId:  updated.deadlines_by_step_id ?? {},
          amMemo:             updated.am_memo ?? "",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{label}</p>
          {roadmap.completedStepCount >= ROADMAP_STEPS.length ? (
            <Badge className="bg-green-100 text-green-700 border border-green-200">デビュー完了</Badge>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              現在: ステップ {roadmap.completedStepCount + 1}（{ROADMAP_STEPS[roadmap.completedStepCount]?.label}）
            </p>
          )}
        </div>
        {showOverdue && roadmap.completedStepCount < ROADMAP_STEPS.length && (
          <Badge className="bg-red-100 text-red-700 border border-red-200">期限超過</Badge>
        )}
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
          ) : "期限: 未設定"}
        </span>
      </div>

      {!readOnly && (
        <div className="space-y-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-700 mb-1">ステップ更新</p>
              <select
                className="h-9 w-full rounded-lg border bg-white px-2 text-sm"
                value={String(draftCount)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setDraftCount(n);
                  const sid = getActiveStepId(n);
                  const iso = sid ? roadmap.deadlinesByStepId[sid] ?? "" : "";
                  setDeadlineLocal(iso ? toDatetimeLocalValue(iso) : "");
                }}
              >
                {ROADMAP_STEPS.map((s, i) => (
                  <option key={s.id} value={String(i)}>ステップ {i + 1}: {s.short}</option>
                ))}
                <option value={String(ROADMAP_STEPS.length)}>デビュー完了</option>
              </select>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-700 mb-1">完了期限</p>
              <input
                type="datetime-local"
                className="h-9 w-full rounded-lg border bg-white px-2 text-sm"
                value={deadlineLocal}
                onChange={(e) => setDeadlineLocal(e.target.value)}
                disabled={draftCount >= ROADMAP_STEPS.length}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">AMメモ</p>
            <textarea
              className="w-full min-h-[80px] rounded-lg border bg-white p-2 text-sm"
              value={draftMemo}
              onChange={(e) => setDraftMemo(e.target.value)}
              placeholder="例: ターゲット選定に苦戦中..."
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} size="sm" disabled={saving}>
              {saving ? "保存中..." : "更新"}
            </Button>
          </div>
        </div>
      )}

      {readOnly && (
        <p className="text-xs text-gray-500">
          次の期限: {activeDeadlineIso
            ? formatRemainingTime(activeDeadlineIso, new Date()).label
            : "未設定"}
        </p>
      )}
    </Card>
  );
}
