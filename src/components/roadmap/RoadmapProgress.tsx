"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppointerRoadmap } from "@/types/roadmap";
import { ROADMAP_STEPS } from "@/types/roadmap";
import { Progress } from "@/components/ui/progress";
import { formatRemainingTime } from "@/lib/time";
import { getActiveStepId, getDebutProgressPercentRounded, getPercentFromCompletedStepCount, isOverdueByRegisteredAt } from "@/lib/roadmapUtils";
import { Badge } from "@/components/ui/badge";

function getStepState(completedStepCount: number, stepIndex: number) {
  if (stepIndex < completedStepCount) return "done";
  if (stepIndex === completedStepCount) return "active";
  return "todo";
}

export default function RoadmapProgress({
  roadmap,
  label,
  showOverdueBadge = false,
  showSteps = true,
  showMemo = false,
  memo,
}: {
  roadmap: AppointerRoadmap;
  label: string;
  showOverdueBadge?: boolean;
  showSteps?: boolean;
  showMemo?: boolean;
  memo?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const activeStepId = useMemo(() => getActiveStepId(roadmap), [roadmap]);
  const activeDeadlineAtIso = useMemo(() => {
    if (!activeStepId) return null;
    return roadmap.deadlinesByStepId[activeStepId] ?? null;
  }, [activeStepId, roadmap.deadlinesByStepId]);

  const deadlineInfo = useMemo(() => {
    if (!activeDeadlineAtIso) return { label: "次の期限：未設定", isOverdue: false };
    const info = formatRemainingTime(activeDeadlineAtIso, now);
    return { label: `次の期限：${info.label}`, isOverdue: info.isOverdue };
  }, [activeDeadlineAtIso, now]);

  const progressPct = useMemo(() => getPercentFromCompletedStepCount(roadmap.completedStepCount), [roadmap.completedStepCount]);

  const showOverdue = showOverdueBadge ? isOverdueByRegisteredAt(roadmap, now) : false;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">進捗: デビューまで {getDebutProgressPercentRounded(roadmap)}%</p>
        </div>
        <div className="flex items-center gap-2">
          {showOverdue && (
            <Badge className="bg-red-100 text-red-700 border border-red-200">
              期限超過
            </Badge>
          )}
          {roadmap.completedStepCount >= ROADMAP_STEPS.length && (
            <Badge className="bg-green-100 text-green-700 border border-green-200">デビュー完了</Badge>
          )}
        </div>
      </div>

      <Progress value={progressPct} className="mt-1" />
      <div className="text-xs text-gray-600">{deadlineInfo.label}</div>

      {showSteps && (
        <div className="rounded-xl border bg-white p-3">
          <ol className="space-y-2">
            {ROADMAP_STEPS.map((s, idx) => {
              const state = getStepState(roadmap.completedStepCount, idx);
              return (
                <li key={s.id} className="flex items-start gap-2">
                  <span className="mt-0.5 text-sm" aria-hidden="true">
                    {state === "done" ? "✓" : state === "active" ? "●" : "○"}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm ${state === "done" ? "text-gray-900" : state === "active" ? "text-indigo-700 font-medium" : "text-gray-500"}`}>
                      {idx + 1}. {s.label}
                    </p>
                    {activeStepId === s.id && (
                      <p className={`text-xs ${deadlineInfo.isOverdue ? "text-red-600" : "text-gray-500"}`}>
                        {activeDeadlineAtIso ? "期限付き" : "期限なし"}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {showMemo && (
        <div className="rounded-xl border bg-gray-50 p-3">
          <p className="text-xs text-gray-500">AMメモ</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{memo && memo.trim() ? memo : "—"}</p>
        </div>
      )}
    </div>
  );
}

