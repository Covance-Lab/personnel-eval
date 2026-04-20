"use client";

/**
 * RoadmapAppointerRowDB — フェーズ別17ステップ表示
 * AM / Sales / Admin / Appointer（本人）全ロール対応
 */

import { useMemo, useState } from "react";
import type { AppointerRoadmap, RoadmapStepId } from "@/types/roadmap";
import { ROADMAP_PHASES, ROADMAP_STEPS } from "@/types/roadmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { isOverdueByRegisteredAt, getPercentFromCompletedStepCount } from "@/lib/roadmapUtils";
import { CheckCircle2, Circle, Undo2 } from "lucide-react";

// date input (YYYY-MM-DD) ↔ ISO 変換
function toDateValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
function fromDateValue(val: string): string | null {
  if (!val) return null;
  const d = new Date(`${val}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export default function RoadmapAppointerRowDB({
  userId,
  label,
  roadmap,
  readOnly,
  showAmMemo = true,
  onUpdated,
}: {
  userId: string;
  label: string;
  roadmap: AppointerRoadmap;
  readOnly: boolean;
  showAmMemo?: boolean;
  onUpdated: (next: AppointerRoadmap) => void;
}) {
  const totalSteps = ROADMAP_STEPS.length; // 17

  // ── draft state ──────────────────────────────────────────────────
  const [draftCount, setDraftCount] = useState(roadmap.completedStepCount);
  const [draftDeadlines, setDraftDeadlines] = useState<Partial<Record<RoadmapStepId, string>>>(
    () => ({ ...roadmap.deadlinesByStepId })
  );
  const [draftMemo, setDraftMemo] = useState(roadmap.amMemo ?? "");
  const [saving, setSaving] = useState(false);

  const progressPct = getPercentFromCompletedStepCount(draftCount);
  const debuted     = draftCount >= totalSteps;
  const showOverdue = isOverdueByRegisteredAt(roadmap, new Date());

  // デッドライン変更
  function handleDeadlineChange(stepId: RoadmapStepId, val: string) {
    const iso = fromDateValue(val);
    setDraftDeadlines((prev) => {
      const next = { ...prev };
      if (iso) next[stepId] = iso;
      else delete next[stepId];
      return next;
    });
  }

  // 完了ボタン（現在のアクティブステップを完了）
  function handleComplete() {
    if (draftCount < totalSteps) setDraftCount((c) => c + 1);
  }

  // 戻すボタン（直近の完了ステップを取り消し）
  function handleUndo() {
    if (draftCount > 0) setDraftCount((c) => c - 1);
  }

  // 保存
  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        completed_step_count: Math.max(0, Math.min(totalSteps, draftCount)),
        deadlines_by_step_id: draftDeadlines,
      };
      if (showAmMemo) body.am_memo = draftMemo;

      const res = await fetch(`/api/roadmap/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { roadmap: updated } = await res.json();
        onUpdated({
          userId,
          registeredAt:       updated.registered_at,
          completedStepCount: updated.completed_step_count,
          deadlinesByStepId:  updated.deadlines_by_step_id ?? {},
          amMemo:             updated.am_memo ?? "",
          salesMemo:          updated.sales_memo ?? "",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const isDirty = useMemo(() => {
    if (draftCount !== roadmap.completedStepCount) return true;
    if (draftMemo  !== (roadmap.amMemo ?? ""))     return true;
    const orig = roadmap.deadlinesByStepId;
    for (const s of ROADMAP_STEPS) {
      if ((draftDeadlines[s.id] ?? "") !== (orig[s.id] ?? "")) return true;
    }
    return false;
  }, [draftCount, draftMemo, draftDeadlines, roadmap]);

  return (
    <Card className="p-4 space-y-3">
      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{label}</p>
          {debuted ? (
            <Badge className="bg-green-100 text-green-700 border border-green-200 mt-1">デビュー完了</Badge>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              ステップ {draftCount + 1} / {totalSteps} — {ROADMAP_STEPS[draftCount]?.label}
            </p>
          )}
        </div>
        {showOverdue && !debuted && (
          <Badge className="bg-red-100 text-red-700 border border-red-200 shrink-0">期限超過</Badge>
        )}
      </div>

      {/* ── プログレスバー ── */}
      <Progress value={progressPct} className="mt-1" />
      <p className="text-xs text-gray-500 text-right">{draftCount} / {totalSteps} 完了</p>

      {/* ── フェーズ別ステップ一覧 ── */}
      <div className="space-y-4">
        {ROADMAP_PHASES.map((phase) => {
          const phaseStepIndices = phase.steps.map((s) => ROADMAP_STEPS.findIndex((r) => r.id === s.id));
          const phaseDone = phaseStepIndices.every((i) => i < draftCount);
          const phaseActive = !phaseDone && phaseStepIndices.some((i) => i <= draftCount);

          return (
            <div key={phase.id}>
              {/* フェーズヘッダー */}
              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg mb-1 text-xs font-bold ${
                phaseDone
                  ? "bg-green-50 text-green-700"
                  : phaseActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-gray-50 text-gray-400"
              }`}>
                <span>{phase.label}</span>
                {phaseDone && <span className="text-green-600">✓ 完了</span>}
              </div>

              {/* ステップ行 */}
              <ol className="space-y-1">
                {phase.steps.map((stepDef) => {
                  const stepIdx = ROADMAP_STEPS.findIndex((r) => r.id === stepDef.id);
                  const globalNum = stepIdx + 1;
                  const isDone   = stepIdx < draftCount;
                  const isActive = stepIdx === draftCount;
                  const isLastDone = stepIdx === draftCount - 1;

                  return (
                    <li key={stepDef.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                      isDone ? "bg-green-50" : isActive ? "bg-indigo-50" : "bg-white"
                    }`}>
                      {/* 状態アイコン */}
                      <span className="shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : isActive ? (
                          <Circle className="w-4 h-4 text-indigo-500 fill-indigo-100" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300" />
                        )}
                      </span>

                      {/* ステップ番号＋ラベル */}
                      <span className={`flex-1 text-xs ${
                        isDone ? "text-gray-500 line-through" : isActive ? "text-indigo-700 font-semibold" : "text-gray-400"
                      }`}>
                        {globalNum}. {stepDef.label}
                      </span>

                      {/* 期限入力 */}
                      {!readOnly && (
                        <input
                          type="date"
                          className={`h-7 rounded border px-1.5 text-xs w-32 shrink-0 ${
                            isDone ? "bg-gray-50 text-gray-400" : "bg-white"
                          }`}
                          value={toDateValue(draftDeadlines[stepDef.id])}
                          onChange={(e) => handleDeadlineChange(stepDef.id, e.target.value)}
                          disabled={isDone && !isLastDone}
                          title="期限"
                        />
                      )}
                      {readOnly && draftDeadlines[stepDef.id] && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {toDateValue(draftDeadlines[stepDef.id])}
                        </span>
                      )}

                      {/* 完了ボタン / 戻すボタン */}
                      {!readOnly && (
                        <div className="shrink-0 w-16 flex justify-end">
                          {isActive && (
                            <button
                              onClick={handleComplete}
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-transform"
                            >
                              完了
                            </button>
                          )}
                          {isLastDone && (
                            <button
                              onClick={handleUndo}
                              className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                              title="直前のステップに戻す"
                            >
                              <Undo2 className="w-3 h-3" />
                              戻す
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>

      {/* ── AMメモ ── */}
      {!readOnly && showAmMemo && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">AMメモ</p>
          <textarea
            className="w-full min-h-[72px] rounded-lg border bg-white p-2 text-sm resize-none"
            value={draftMemo}
            onChange={(e) => setDraftMemo(e.target.value)}
            placeholder="例: フォロワー増加で苦戦中..."
          />
        </div>
      )}

      {readOnly && roadmap.amMemo && (
        <div className="rounded-lg bg-gray-50 border px-3 py-2">
          <p className="text-xs text-gray-500 mb-0.5">AMメモ</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{roadmap.amMemo}</p>
        </div>
      )}

      {/* ── 保存ボタン ── */}
      {!readOnly && (
        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSave}
            size="sm"
            disabled={saving || !isDirty}
            className={isDirty ? "" : "opacity-50"}
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      )}
    </Card>
  );
}
