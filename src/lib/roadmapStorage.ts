import type { AppointerRoadmap, RoadmapStepId } from "@/types/roadmap";
import { getUserAccountById } from "@/data/mockUsers";

const STORAGE_PREFIX = "pe_roadmap_";
const KEY_ROADMAPS_BY_USER_ID = `${STORAGE_PREFIX}byUserId`;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function safeReadJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const DEFAULT_APPINTER_PRESETS: Record<
  string,
  {
    registeredDaysAgo: number;
    completedStepCount: number;
    deadlines?: Partial<Record<RoadmapStepId, number>>; // daysFromNow
  }
> = {
  "ap-tsujii-01": {
    registeredDaysAgo: 45,
    completedStepCount: 3,
    deadlines: { step4: 2 },
  },
  "ap-tsujii-02": {
    registeredDaysAgo: 12,
    completedStepCount: 0,
    deadlines: { step1: 10 },
  },
  "ap-lumia-01": {
    registeredDaysAgo: 75,
    completedStepCount: 7,
    deadlines: { step8: -3 },
  },
  "ap-lumia-02": {
    registeredDaysAgo: 8,
    completedStepCount: 12,
    deadlines: { step13: 1 },
  },
};

function isAppointerUser(userId: string): boolean {
  const account = getUserAccountById(userId);
  return account?.role === "Appointer";
}

export function loadRoadmapsByUserId(): Record<string, AppointerRoadmap> {
  return safeReadJson<Record<string, AppointerRoadmap>>(KEY_ROADMAPS_BY_USER_ID, {});
}

export function getRoadmapForUserId(userId: string): AppointerRoadmap | null {
  const map = loadRoadmapsByUserId();
  return map[userId] ?? null;
}

function initRoadmapForUserId(userId: string): AppointerRoadmap | null {
  if (!isAppointerUser(userId)) return null;

  const preset = DEFAULT_APPINTER_PRESETS[userId];
  const registeredAt = daysAgoIso(preset?.registeredDaysAgo ?? 20);
  const completedStepCount = preset?.completedStepCount ?? 0;

  const deadlinesByStepId: Partial<Record<RoadmapStepId, string>> = {};
  if (preset?.deadlines) {
    Object.entries(preset.deadlines).forEach(([stepId, days]) => {
      deadlinesByStepId[stepId as RoadmapStepId] = daysFromNowIso(days);
    });
  }

  const roadmap: AppointerRoadmap = {
    userId,
    registeredAt,
    completedStepCount,
    deadlinesByStepId,
    amMemo: "",
  };

  const map = loadRoadmapsByUserId();
  map[userId] = roadmap;
  safeWriteJson(KEY_ROADMAPS_BY_USER_ID, map);

  return roadmap;
}

export function getRoadmapOrInitForUserId(userId: string): AppointerRoadmap | null {
  const existing = getRoadmapForUserId(userId);
  if (existing) return existing;
  return initRoadmapForUserId(userId);
}

export function upsertRoadmapForUserId(
  userId: string,
  updater: (prev: AppointerRoadmap) => AppointerRoadmap
): AppointerRoadmap | null {
  const existing = getRoadmapOrInitForUserId(userId);
  if (!existing) return null;

  const next = updater(existing);
  const map = loadRoadmapsByUserId();
  map[userId] = next;
  safeWriteJson(KEY_ROADMAPS_BY_USER_ID, map);
  return next;
}

export function clearRoadmapPrototypeData(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_ROADMAPS_BY_USER_ID);
}

