import type { AppointerRoadmap, RoadmapStepId } from "@/types/roadmap";
import { ROADMAP_STEPS } from "@/types/roadmap";

export function getActiveStepId(roadmap: AppointerRoadmap): RoadmapStepId | null {
  if (roadmap.completedStepCount >= ROADMAP_STEPS.length) return null;
  return ROADMAP_STEPS[roadmap.completedStepCount]?.id ?? null;
}

export function getDebutProgressPercent(roadmap: AppointerRoadmap): number {
  const steps = ROADMAP_STEPS.length;
  const completed = Math.max(0, Math.min(roadmap.completedStepCount, steps));
  return completed * (100 / steps);
}

export function getDebutProgressPercentRounded(roadmap: AppointerRoadmap): string {
  const pct = getDebutProgressPercent(roadmap);
  return pct.toFixed(1);
}

export function isDebuted(roadmap: AppointerRoadmap): boolean {
  return roadmap.completedStepCount >= ROADMAP_STEPS.length;
}

export function getStepLabel(stepId: RoadmapStepId): string {
  return ROADMAP_STEPS.find((s) => s.id === stepId)?.label ?? stepId;
}

export function getStepShortLabel(stepId: RoadmapStepId): string {
  return ROADMAP_STEPS.find((s) => s.id === stepId)?.short ?? stepId;
}

export function isOverdueByRegisteredAt(roadmap: AppointerRoadmap, now = new Date()): boolean {
  if (isDebuted(roadmap)) return false;
  const reg = new Date(roadmap.registeredAt);
  if (!Number.isFinite(reg.getTime())) return false;
  const due = new Date(reg);
  due.setMonth(due.getMonth() + 1);
  return now.getTime() > due.getTime();
}

export function getPercentFromCompletedStepCount(completedStepCount: number): number {
  const steps = ROADMAP_STEPS.length;
  return Math.max(0, Math.min(completedStepCount, steps)) * (100 / steps);
}

export function getActiveStepIndex(completedStepCount: number): number {
  if (completedStepCount >= ROADMAP_STEPS.length) return ROADMAP_STEPS.length;
  return completedStepCount;
}

