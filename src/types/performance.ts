import type { TeamGroup } from "@/types/user";

// ─── Google Sheets 列マッピング設定 ────────────────────────────────

/**
 * スプレッドシートの列番号 (A, B, C ... or 0-indexed number)
 * 文字列 "A"〜"Z" or "AA" 等のアルファベット表記で指定
 */
export interface SheetColumnMapping {
  /** 名前 / あだ名列 */
  nameColumn: string;
  /** DM送信数列 */
  dmCountColumn: string;
  /** アポ獲得数列 */
  appoCountColumn: string;
  /** 見込み月収列 */
  incomeColumn: string;
  /** データ開始行 (1-indexed, ヘッダーを含む行の次) */
  dataStartRow: number;
}

/** チームごとのスプレッドシート設定 */
export interface SheetConfig {
  /** チーム識別子 */
  team: TeamGroup;
  /** スプレッドシートのURL (GoogleのフルURL) */
  spreadsheetUrl: string;
  /** URLから抽出したSpreadsheet ID (自動抽出) */
  spreadsheetId: string;
  /** 対象シート名 (タブ名, 空の場合は1枚目) */
  sheetName: string;
  /** 列マッピング設定 */
  columns: SheetColumnMapping;
  /** 最終URL更新日時 */
  updatedAt: string;
}

/** シート設定のデフォルト列マッピング */
export const DEFAULT_COLUMN_MAPPING: SheetColumnMapping = {
  nameColumn: "A",
  dmCountColumn: "B",
  appoCountColumn: "C",
  incomeColumn: "D",
  dataStartRow: 2,
};

// ─── 実績データ (Performance) ─────────────────────────────────────

/** 1名・1ヶ月分のアポインター実績データ */
export interface PerformanceRecord {
  /** ユーザーID (システム内) */
  userId: string;
  /** スプレッドシート上の名前/あだ名 (紐付けキー) */
  sheetName: string;
  /** 集計年 */
  year: number;
  /** 集計月 (1〜12) */
  month: number;
  /** 累計DM送信数 */
  dmCount: number;
  /** アポ獲得数 */
  appoCount: number;
  /** アポ獲得率 (appoCount / dmCount) */
  appointmentRate: number;
  /** 見込み月収 (円) */
  income: number;
  /** 本人が設定した期待月収 (円) — 離脱リスク算定に使用 */
  expectedIncome?: number;
  /** データ取得元チーム */
  team: TeamGroup;
  /** 同期日時 */
  syncedAt: string;
}

// ─── 同期ログ ───────────────────────────────────────────────────

export type SyncStatus = "success" | "partial" | "error";

export interface SyncLog {
  id: string;
  team: TeamGroup;
  syncedAt: string;
  status: SyncStatus;
  /** 処理したレコード数 */
  processedCount: number;
  /** スキップ (名前紐付け失敗) したレコード数 */
  skippedCount: number;
  /** エラーメッセージ */
  errorMessage?: string;
}

// ─── 離脱リスク分析結果 ───────────────────────────────────────────

export type PerformanceAlertType =
  | "slump"          // アポ獲得率が過去平均より大幅低下
  | "low_income"     // 月収が期待額を下回り続けている
  | "no_data"        // データなし
  | "zero_activity"; // DM数がゼロ

export interface PerformanceAlert {
  type: PerformanceAlertType;
  label: string;
  detail: string;
  severity: "warning" | "critical";
}

// ─── API リクエスト / レスポンス型 ───────────────────────────────

export interface SyncRequest {
  team: TeamGroup;
  /** 対象年月 (省略時は今月) */
  year?: number;
  month?: number;
}

export interface SyncResponse {
  ok: boolean;
  log: SyncLog;
  records: PerformanceRecord[];
  /** モックモードで動作したか */
  mockMode: boolean;
}

// ─── ユーティリティ ───────────────────────────────────────────────

/**
 * GoogleスプレッドシートのURLからSpreadsheet IDを抽出する
 * https://docs.google.com/spreadsheets/d/{ID}/edit...
 */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/** アポ獲得率を計算 (DM数が0の場合は0) */
export function calcAppointmentRate(appoCount: number, dmCount: number): number {
  if (dmCount === 0) return 0;
  return Math.round((appoCount / dmCount) * 1000) / 10; // % with 1 decimal
}

/** 過去Nヶ月の平均アポ獲得率を計算 */
export function calcAverageRate(
  records: PerformanceRecord[],
  excludeLatest = true
): number | null {
  const sorted = [...records].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  const target = excludeLatest ? sorted.slice(1) : sorted;
  if (target.length === 0) return null;
  const sum = target.reduce((acc, r) => acc + r.appointmentRate, 0);
  return Math.round((sum / target.length) * 10) / 10;
}

/** 離脱リスクアラートを分析する */
export function analyzePerformanceAlerts(
  records: PerformanceRecord[],
  expectedIncome?: number
): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  if (records.length === 0) {
    alerts.push({
      type: "no_data",
      label: "データ未取得",
      detail: "スプレッドシートとの同期が完了していません",
      severity: "warning",
    });
    return alerts;
  }

  const sorted = [...records].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  const latest = sorted[0];

  // DM数ゼロ
  if (latest.dmCount === 0) {
    alerts.push({
      type: "zero_activity",
      label: "離脱リスク：活動停止",
      detail: `今月のDM数が0件です`,
      severity: "critical",
    });
  }

  // アポ獲得率スランプ (過去平均より30%以上低下)
  const avgRate = calcAverageRate(sorted);
  if (avgRate !== null && latest.dmCount > 0) {
    const drop = avgRate - latest.appointmentRate;
    if (drop >= 30) {
      alerts.push({
        type: "slump",
        label: "離脱リスク：スランプ",
        detail: `アポ獲得率が過去平均(${avgRate}%)より${drop.toFixed(1)}%低下 (今月: ${latest.appointmentRate}%)`,
        severity: "critical",
      });
    } else if (drop >= 15) {
      alerts.push({
        type: "slump",
        label: "離脱リスク：獲得率低下",
        detail: `アポ獲得率が過去平均(${avgRate}%)より${drop.toFixed(1)}%低下 (今月: ${latest.appointmentRate}%)`,
        severity: "warning",
      });
    }
  }

  // 月収が期待額を2ヶ月連続で下回っている
  const expected = expectedIncome ?? latest.expectedIncome;
  if (expected && expected > 0) {
    const belowExpected = sorted.slice(0, 2).filter((r) => r.income < expected);
    if (belowExpected.length >= 2) {
      alerts.push({
        type: "low_income",
        label: "離脱リスク：低報酬",
        detail: `月収(${latest.income.toLocaleString()}円)が期待額(${expected.toLocaleString()}円)を2ヶ月連続で下回っています`,
        severity: "critical",
      });
    } else if (belowExpected.length === 1) {
      alerts.push({
        type: "low_income",
        label: "低報酬注意",
        detail: `今月の月収(${latest.income.toLocaleString()}円)が期待額(${expected.toLocaleString()}円)を下回っています`,
        severity: "warning",
      });
    }
  }

  return alerts;
}
