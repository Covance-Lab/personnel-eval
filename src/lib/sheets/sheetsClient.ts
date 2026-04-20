/**
 * Google Sheets API クライアント (サーバーサイド専用)
 *
 * 認証方式: サービスアカウント (環境変数 GOOGLE_SERVICE_ACCOUNT_KEY に JSON を設定)
 * モックモード: 環境変数が未設定の場合はモックデータを返す
 */

import { google } from "googleapis";

export type SheetRow = (string | number)[];

// ─── 認証ヘルパー ─────────────────────────────────────────────────

function getCredentials(): Record<string, unknown> | null {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) return null;
  try {
    return JSON.parse(serviceAccountKey);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY の JSON パースに失敗しました。環境変数の値を確認してください。");
  }
}

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

  const credentials = getCredentials();
  if (!credentials) {
    console.warn("[SheetsClient] GOOGLE_SERVICE_ACCOUNT_KEY is not set. Using mock data.");
    return { rows: generateMockRows(), isMock: true };
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
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

/**
 * Google Sheets の指定シートに行を追記する (append)
 * @returns isMock 認証情報未設定のためスキップしたか
 */
export async function appendSheetRow(params: {
  spreadsheetId: string;
  sheetName: string;
  values: (string | number)[];
}): Promise<{ isMock: boolean }> {
  const { spreadsheetId, sheetName, values } = params;

  const credentials = getCredentials();
  if (!credentials) {
    console.warn("[SheetsClient] GOOGLE_SERVICE_ACCOUNT_KEY is not set. Append skipped (mock mode).");
    return { isMock: true };
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const range = sheetName ? `${sheetName}!A:A` : "A:A";

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
    return { isMock: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Google Sheets 書き込みエラー: ${message}`);
  }
}

/**
 * Google Sheets の指定行を更新する (update by row index)
 */
export async function updateSheetRow(params: {
  spreadsheetId: string;
  sheetName: string;
  rowIndex: number; // 1-indexed (1=row 1)
  values: (string | number)[];
}): Promise<{ isMock: boolean }> {
  const { spreadsheetId, sheetName, rowIndex, values } = params;

  const credentials = getCredentials();
  if (!credentials) {
    console.warn("[SheetsClient] GOOGLE_SERVICE_ACCOUNT_KEY is not set. Update skipped (mock mode).");
    return { isMock: true };
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const endCol = String.fromCharCode(65 + values.length - 1); // A + (n-1) columns
  const range = sheetName ? `${sheetName}!A${rowIndex}:${endCol}${rowIndex}` : `A${rowIndex}:${endCol}${rowIndex}`;

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
    return { isMock: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Google Sheets 更新エラー: ${message}`);
  }
}

// ─── モックデータ生成 ─────────────────────────────────────────────

function generateMockRows(): SheetRow[] {
  return [
    ["名前", "DM数", "アポ獲得数", "見込み月収"],
    ["はなちゃん", "120",  "18", "85000"],
    ["たろう",     "80",   "8",  "42000"],
    ["さくら",     "40",   "4",  "20000"],
    ["けん",       "10",   "1",  "5000"],
    ["みほちゃん", "200",  "50", "180000"],
    ["なかむら",   "0",    "0",  "0"],
    ["こばやし",   "150",  "32", "135000"],
  ];
}
