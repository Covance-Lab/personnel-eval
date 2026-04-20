"use client";

import { useMemo } from "react";
import type { AppointerRoadmap } from "@/types/roadmap";
import { ROADMAP_PHASES, ROADMAP_STEPS } from "@/types/roadmap";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { getDebutProgressPercentRounded, getPercentFromCompletedStepCount, isOverdueByRegisteredAt } from "@/lib/roadmapUtils";

function toDateValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
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
  const totalSteps  = ROADMAP_STEPS.length;
  const completed   = roadmap.completedStepCount;
  const debuted     = completed >= totalSteps;
  const progressPct = useMemo(() => getPercentFromCompletedStepCount(completed), [completed]);
  const showOverdue = showOverdueBadge ? isOverdueByRegisteredAt(roadmap, new Date()) : false;

  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">進捗: デビューまで {getDebutProgressPercentRounded(roadmap)}%</p>
        </div>
        <div className="flex items-center gap-2">
          {showOverdue && (
            <Badge className="bg-red-100 text-red-700 border border-red-200">期限超過</Badge>
          )}
          {debuted && (
            <Badge className="bg-green-100 text-green-700 border border-green-200">デビュー完了</Badge>
          )}
        </div>
      </div>

      <Progress value={progressPct} className="mt-1" />
      <p className="text-xs text-gray-500 text-right">{completed} / {totalSteps} 完了</p>

      {showSteps && (
        <div className="rounded-xl border bg-white p-3 space-y-4">
          {ROADMAP_PHASES.map((phase) => {
            const indices = phase.steps.map((s) => ROADMAP_STEPS.findIndex((r) => r.id === s.id));
            const phaseDone   = indices.every((i) => i < completed);
            const phaseActive = !phaseDone && indices.some((i) => i <= completed);

            return (
              <div key={phase.id}>
                {/* フェーズラベル */}
                <p className={`text-xs font-bold px-2 py-1 rounded mb-1 ${
                  phaseDone ? "bg-green-50 text-green-700"
                  : phaseActive ? "bg-indigo-50 text-indigo-700"
                  : "bg-gray-50 text-gray-400"
                }`}>
                  {phase.label}{phaseDone && " ✓"}
                </p>

                <ol className="space-y-1">
                  {phase.steps.map((stepDef) => {
                    const idx      = ROADMAP_STEPS.findIndex((r) => r.id === stepDef.id);
                    const globalNum = idx + 1;
                    const isDone   = idx < completed;
                    const isActive = idx === completed;
                    const deadline = roadmap.deadlinesByStepId[stepDef.id];

                    return (
                      <li key={stepDef.id} className={`flex items-center gap-2 px-2 py-1 rounded ${
                        isDone ? "bg-green-50" : isActive ? "bg-indigo-50" : ""
                      }`}>
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        ) : isActive ? (
                          <Circle className="w-3.5 h-3.5 text-indigo-500 fill-indigo-100 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        )}
                        <span className={`flex-1 text-xs ${
                          isDone ? "text-gray-500 line-through" : isActive ? "text-indigo-700 font-semibold" : "text-gray-400"
                        }`}>
                          {globalNum}. {stepDef.label}
                        </span>
                        {!isDone && deadline && (
                          <span className={`text-xs shrink-0 ${isActive ? "text-indigo-500" : "text-gray-400"}`}>
                            {toDateValue(deadline)}まで
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
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
