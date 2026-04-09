/**
 * Google Sheets 連携設定を localStorage に保存・読み込みする
 *
 * ・設定はクライアントサイドの localStorage に保存
 * ・API ルートへはリクエスト body 経由で渡す (サーバーは env vars でのみ認証)
 */

import type { SheetConfig, SheetColumnMapping } from "@/types/performance";
import { DEFAULT_COLUMN_MAPPING, extractSpreadsheetId } from "@/types/performance";
import type { TeamGroup } from "@/types/user";

const STORAGE_KEY = "pe_sheet_configs";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function loadAll(): Record<TeamGroup, SheetConfig | null> {
  if (!isBrowser()) return { 辻利: null, LUMIA: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { 辻利: null, LUMIA: null };
    return JSON.parse(raw) as Record<TeamGroup, SheetConfig | null>;
  } catch {
    return { 辻利: null, LUMIA: null };
  }
}

function saveAll(configs: Record<TeamGroup, SheetConfig | null>): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

/** 指定チームのシート設定を取得 */
export function getSheetConfig(team: TeamGroup): SheetConfig | null {
  return loadAll()[team] ?? null;
}

/** 全チームのシート設定を取得 */
export function getAllSheetConfigs(): Record<TeamGroup, SheetConfig | null> {
  return loadAll();
}

/**
 * チームのスプレッドシートURLを更新・保存する
 * URLからSpreadsheet IDを自動抽出し、設定を上書き保存する
 */
export function saveSheetConfig(
  team: TeamGroup,
  spreadsheetUrl: string,
  sheetName: string,
  columns?: Partial<SheetColumnMapping>
): { ok: boolean; error?: string; config?: SheetConfig } {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    return {
      ok: false,
      error:
        "URLからスプレッドシートIDを取得できませんでした。GoogleスプレッドシートのURLを正しく入力してください。",
    };
  }

  const all = loadAll();
  const existing = all[team];

  const config: SheetConfig = {
    team,
    spreadsheetUrl,
    spreadsheetId,
    sheetName,
    columns: {
      ...DEFAULT_COLUMN_MAPPING,
      ...(existing?.columns ?? {}),
      ...columns,
    },
    updatedAt: new Date().toISOString(),
  };

  all[team] = config;
  saveAll(all);
  return { ok: true, config };
}

/** 列マッピングのみ更新 */
export function saveColumnMapping(
  team: TeamGroup,
  columns: Partial<SheetColumnMapping>
): boolean {
  const all = loadAll();
  const existing = all[team];
  if (!existing) return false;

  all[team] = {
    ...existing,
    columns: { ...existing.columns, ...columns },
    updatedAt: new Date().toISOString(),
  };
  saveAll(all);
  return true;
}

/** 設定をリセット */
export function resetSheetConfig(team: TeamGroup): void {
  const all = loadAll();
  all[team] = null;
  saveAll(all);
}
