/**
 * Google Sheets API クライアント (サーバーサイド専用)
 *
 * 認証方式: サービスアカウント (環境変数 GOOGLE_SERVICE_ACCOUNT_KEY に JSON を設定)
 * モックモード: 環境変数が未設定の場合はモックデータを返す
 */

import { google } from "googleapis";

export type SheetRow = string[];

/**
 * Google Sheets から指定範囲のセルデータを取得する
 * @returns rows  行データ (各行は文字列配列)
 * @returns isMock  認証情報未設定のためモックデータを使用したか
 */
export async function fetchSheetRange(params: {
  spreadsheetId: string;
  sheetName: string;
  range: string; // e.g. "A1:Z200"
}): Promise<{ rows: SheetRow[]; isMock: boolean }> {
  const { spreadsheetId, sheetName, range } = params;

  // ─── サービスアカウント認証 ───────────────────────────────────
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    // 認証情報が未設定 → モックモードで動作
    console.warn("[SheetsClient] GOOGLE_SERVICE_ACCOUNT_KEY is not set. Using mock data.");
    return { rows: generateMockRows(), isMock: true };
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(serviceAccountKey);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY の JSON パースに失敗しました。環境変数の値を確認してください。"
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // シート名を含む範囲指定: "シート名!A1:Z200"
  const fullRange = sheetName ? `${sheetName}!${range}` : range;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const rows = (response.data.values ?? []) as SheetRow[];
    return { rows, isMock: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Google Sheets API エラー: ${message}`);
  }
}

// ─── モックデータ生成 ─────────────────────────────────────────────

/**
 * 開発・デモ用のモック行データを生成する
 * 列順: [名前, DM数, アポ獲得数, 見込み月収]
 */
function generateMockRows(): SheetRow[] {
  return [
    ["名前", "DM数", "アポ獲得数", "見込み月収"],   // ヘッダー行
    ["はなちゃん", "120",  "18", "85000"],
    ["たろう",     "80",   "8",  "42000"],
    ["さくら",     "40",   "4",  "20000"],
    ["けん",       "10",   "1",  "5000"],
    ["みほちゃん", "200",  "50", "180000"],
    ["なかむら",   "0",    "0",  "0"],
    ["こばやし",   "150",  "32", "135000"],
  ];
}
