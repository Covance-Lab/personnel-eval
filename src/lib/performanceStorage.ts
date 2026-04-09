/**
 * アポインター実績データ (PerformanceRecord) を localStorage に保存・読み込みする
 *
 * キー構造:
 *   pe_performance_records  → PerformanceRecord[]  (全件フラット配列)
 *   pe_sync_logs            → SyncLog[]
 */

import type { PerformanceRecord, SyncLog } from "@/types/performance";
import type { TeamGroup } from "@/types/user";

const KEY_RECORDS = "pe_performance_records";
const KEY_LOGS = "pe_sync_logs";

// ─── ユーティリティ ───────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

// ─── PerformanceRecord CRUD ───────────────────────────────────────

/** 全実績レコードを取得 */
export function loadAllRecords(): PerformanceRecord[] {
  return readJson<PerformanceRecord[]>(KEY_RECORDS, []);
}

/** 特定ユーザーの全実績を取得 (新しい月順) */
export function loadRecordsForUser(userId: string): PerformanceRecord[] {
  return loadAllRecords()
    .filter((r) => r.userId === userId)
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
}

/** 特定ユーザーの今月実績を取得 */
export function loadCurrentMonthRecord(userId: string): PerformanceRecord | null {
  const now = new Date();
  return (
    loadAllRecords().find(
      (r) =>
        r.userId === userId &&
        r.year === now.getFullYear() &&
        r.month === now.getMonth() + 1
    ) ?? null
  );
}

/** 特定チームの今月実績を全件取得 */
export function loadCurrentMonthRecordsByTeam(team: TeamGroup): PerformanceRecord[] {
  const now = new Date();
  return loadAllRecords().filter(
    (r) =>
      r.team === team &&
      r.year === now.getFullYear() &&
      r.month === now.getMonth() + 1
  );
}

/**
 * 実績レコードを一括アップサート
 * 同じ (userId, year, month) のレコードは上書きする
 */
export function upsertRecords(incoming: PerformanceRecord[]): void {
  const existing = loadAllRecords();

  // userId+year+month をキーにして Map に変換
  const map = new Map<string, PerformanceRecord>();
  existing.forEach((r) => map.set(recordKey(r), r));
  incoming.forEach((r) => map.set(recordKey(r), r));

  writeJson(KEY_RECORDS, Array.from(map.values()));
}

/** 期待月収のみ更新 (本人設定用) */
export function updateExpectedIncome(userId: string, expectedIncome: number): void {
  const all = loadAllRecords();
  const updated = all.map((r) =>
    r.userId === userId ? { ...r, expectedIncome } : r
  );
  writeJson(KEY_RECORDS, updated);
}

function recordKey(r: PerformanceRecord): string {
  return `${r.userId}::${r.year}::${r.month}`;
}

// ─── SyncLog CRUD ─────────────────────────────────────────────────

/** 全同期ログを取得 (新しい順, 最大50件) */
export function loadSyncLogs(): SyncLog[] {
  return readJson<SyncLog[]>(KEY_LOGS, []).slice(0, 50);
}

/** 最新の同期ログを取得 */
export function loadLatestSyncLog(team?: TeamGroup): SyncLog | null {
  const logs = loadSyncLogs();
  const filtered = team ? logs.filter((l) => l.team === team) : logs;
  return filtered[0] ?? null;
}

/** 同期ログを追加 */
export function appendSyncLog(log: SyncLog): void {
  const logs = loadSyncLogs();
  writeJson(KEY_LOGS, [log, ...logs].slice(0, 50));
}

/** 全実績データをリセット (開発用) */
export function resetAllPerformanceData(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_RECORDS);
  window.localStorage.removeItem(KEY_LOGS);
}
