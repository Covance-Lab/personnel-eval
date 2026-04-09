import type { MonthlyQuestionnaireAnswer, QuestionnaireMonthKey } from "@/types/questionnaire";

const STORAGE_PREFIX = "pe_questionnaire_";
const KEY_ANSWERS_BY_USER_MONTH = `${STORAGE_PREFIX}answersByUserMonth`;

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

export function getCurrentMonthKey(now = new Date()): QuestionnaireMonthKey {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthKey(monthKey: QuestionnaireMonthKey): { year: number; monthIndex: number } {
  const [y, m] = monthKey.split("-").map((v) => Number(v));
  return { year: y, monthIndex: m - 1 };
}

export function getQuestionnaireDeadlineForMonthKey(monthKey: QuestionnaireMonthKey, deadlineDay = 28): Date {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(deadlineDay, lastDay);
  // ローカル時間の提出期限（23:59）
  return new Date(year, monthIndex, day, 23, 59, 59, 999);
}

export function loadAnswersByUserMonth(): Record<string, MonthlyQuestionnaireAnswer> {
  return safeReadJson<Record<string, MonthlyQuestionnaireAnswer>>(KEY_ANSWERS_BY_USER_MONTH, {});
}

function keyOf(userId: string, monthKey: QuestionnaireMonthKey): string {
  return `${userId}__${monthKey}`;
}

export function getMonthlyAnswerForUser(userId: string, monthKey: QuestionnaireMonthKey): MonthlyQuestionnaireAnswer | null {
  const map = loadAnswersByUserMonth();
  return map[keyOf(userId, monthKey)] ?? null;
}

export function upsertMonthlyAnswerForUser(params: {
  userId: string;
  monthKey: QuestionnaireMonthKey;
  answer: MonthlyQuestionnaireAnswer["answers"];
}): void {
  const map = loadAnswersByUserMonth();
  map[keyOf(params.userId, params.monthKey)] = {
    submittedAt: new Date().toISOString(),
    answers: params.answer,
  };
  safeWriteJson(KEY_ANSWERS_BY_USER_MONTH, map);
}

