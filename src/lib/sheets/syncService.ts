/**
 * Google Sheets からアポインター実績データを取得し、
 * システム内ユーザーと名前で紐付けるサービス層 (サーバーサイド専用)
 */

import { fetchSheetRange } from "./sheetsClient";
import {
  calcAppointmentRate,
  type PerformanceRecord,
  type SheetConfig,
  type SyncLog,
  type SyncResponse,
} from "@/types/performance";
import type { TeamGroup } from "@/types/user";

// ─── 列インデックス変換 ───────────────────────────────────────────

/** Excel 列名 ("A", "B", ... "AA") を 0-indexed の数値に変換 */
function colLetterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.toUpperCase().charCodeAt(i) - 64);
  }
  return index - 1; // 0-indexed
}

// ─── 名前正規化 ───────────────────────────────────────────────────

/** 名前を比較用に正規化 (全角→半角, 空白除去, 小文字化) */
function normalizeName(name: string): string {
  return name
    .normalize("NFKC")   // 全角英数・カタカナを半角に
    .replace(/[\s　]/g, "")
    .toLowerCase();
}

// ─── メイン同期処理 ───────────────────────────────────────────────

export interface SyncServiceParams {
  config: SheetConfig;
  /** システム内ユーザーの {userId: string, nickname: string, name: string}[] */
  userMappings: Array<{ userId: string; nickname: string; name: string }>;
  year: number;
  month: number;
  team: TeamGroup;
}

export async function runSyncService(
  params: SyncServiceParams
): Promise<SyncResponse> {
  const { config, userMappings, year, month, team } = params;

  const logId = `log-${Date.now()}`;
  const syncedAt = new Date().toISOString();

  // ─── 1. Sheets からデータ取得 ────────────────────────────────
  let rows: string[][];
  let isMock = false;
  try {
    const result = await fetchSheetRange({
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      range: `A1:Z500`,
    });
    rows = result.rows;
    isMock = result.isMock;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const errorLog: SyncLog = {
      id: logId,
      team,
      syncedAt,
      status: "error",
      processedCount: 0,
      skippedCount: 0,
      errorMessage: message,
    };
    return {
      ok: false,
      log: errorLog,
      records: [],
      mockMode: false,
    };
  }

  // ─── 2. 列インデックスを解決 ────────────────────────────────
  const cols = config.columns;
  const nameIdx      = colLetterToIndex(cols.nameColumn);
  const dmIdx        = colLetterToIndex(cols.dmCountColumn);
  const appoIdx      = colLetterToIndex(cols.appoCountColumn);
  const incomeIdx    = colLetterToIndex(cols.incomeColumn);
  const dataStartRow = cols.dataStartRow - 1; // 0-indexed

  // ─── 3. ユーザーマッピング辞書 (正規化名 → userId) ─────────
  const nameToUserId = new Map<string, string>();
  userMappings.forEach(({ userId, nickname, name }) => {
    nameToUserId.set(normalizeName(nickname), userId);
    nameToUserId.set(normalizeName(name), userId);
  });

  // ─── 4. 行を処理 ────────────────────────────────────────────
  const records: PerformanceRecord[] = [];
  let skippedCount = 0;

  const dataRows = rows.slice(dataStartRow);
  for (const row of dataRows) {
    const rawName = row[nameIdx]?.toString().trim() ?? "";
    if (!rawName) continue; // 空行スキップ

    const normalizedName = normalizeName(rawName);
    const userId = nameToUserId.get(normalizedName);

    if (!userId) {
      // 名前が一致するユーザーなし
      skippedCount++;
      continue;
    }

    const dmCount    = parseNum(row[dmIdx]);
    const appoCount  = parseNum(row[appoIdx]);
    const income     = parseNum(row[incomeIdx]);
    const rate       = calcAppointmentRate(appoCount, dmCount);

    records.push({
      userId,
      sheetName: rawName,
      year,
      month,
      dmCount,
      appoCount,
      appointmentRate: rate,
      income,
      team,
      syncedAt,
    });
  }

  // ─── 5. 同期ログ生成 ────────────────────────────────────────
  const log: SyncLog = {
    id: logId,
    team,
    syncedAt,
    status: skippedCount > 0 && records.length === 0 ? "error" : skippedCount > 0 ? "partial" : "success",
    processedCount: records.length,
    skippedCount,
  };

  return { ok: true, log, records, mockMode: isMock };
}

// ─── ユーティリティ ───────────────────────────────────────────────

function parseNum(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
