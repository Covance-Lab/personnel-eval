/**
 * メンバーマスタシートへの書き込みロジック（サーバーサイド専用）
 *
 * スプレッドシートの実際の列構成（1行目ヘッダー）:
 *   A: 追加日時
 *   B: フルネーム
 *   C: あだ名
 *   D: 役職
 *   E: チーム名
 *   F: 担当AM（教育係名）
 *   G: （予備）
 *   H: LINE ID
 *
 * LINE ID は H列（index=7）に保存し、重複検索もH列で行う。
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchSheetRange, appendSheetRow, updateSheetRow } from "@/lib/sheets/sheetsClient";

const SHEET_NAME = "メンバーマスタ";
// LINE IDが格納されている列（0-indexed）
const LINE_ID_COL_INDEX = 7; // H列

export async function writeMemberMaster(userId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  isMock?: boolean;
  updated?: boolean;
  reason?: string;
  error?: string;
}> {
  // ユーザー情報取得
  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, name, nickname, role, team, education_mentor_user_id, line_id, line_name")
    .eq("id", userId)
    .single();

  if (userErr || !user) {
    return { ok: false, error: "ユーザーが見つかりません" };
  }

  // 教育係の名前を取得（任意）
  let mentorName = "";
  if (user.education_mentor_user_id) {
    const { data: mentor } = await supabaseAdmin
      .from("users")
      .select("nickname, name")
      .eq("id", user.education_mentor_user_id)
      .single();
    mentorName = mentor?.nickname ?? mentor?.name ?? (user.education_mentor_user_id as string);
  }

  // メンバーマスタスプレッドシート設定を取得
  const { data: cfg } = await supabaseAdmin
    .from("sheet_configs")
    .select("spreadsheet_id")
    .eq("team", "メンバーマスタ")
    .single();

  if (!cfg?.spreadsheet_id) {
    return { ok: true, skipped: true, reason: "メンバーマスタシート未設定" };
  }

  const spreadsheetId = cfg.spreadsheet_id as string;
  const lineId = (user.line_id as string | null) ?? (user.id as string);
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  // スプレッドシートの列順に合わせた書き込み値
  // A:追加日時, B:フルネーム, C:あだ名, D:役職, E:チーム名, F:担当AM, G:（予備）, H:LINE ID
  const rowValues: (string | number)[] = [
    now,                                    // A: 追加日時
    (user.name as string) ?? "",            // B: フルネーム
    (user.nickname as string) ?? "",        // C: あだ名
    (user.role as string) ?? "",            // D: 役職
    (user.team as string) ?? "",            // E: チーム名
    mentorName,                             // F: 担当AM
    "",                                     // G: （予備）
    lineId,                                 // H: LINE ID
  ];

  try {
    // H列（LINE ID列）を取得して既存行を検索
    const { rows } = await fetchSheetRange({
      spreadsheetId,
      sheetName: SHEET_NAME,
      range: "A:H",
    });

    const existingRowIndex = rows.findIndex(
      (r) => String(r[LINE_ID_COL_INDEX] ?? "").trim() === lineId
    );

    let isMock: boolean;
    if (existingRowIndex >= 0) {
      // 既存行を更新（rowIndex は 1-indexed）
      const result = await updateSheetRow({
        spreadsheetId,
        sheetName: SHEET_NAME,
        rowIndex: existingRowIndex + 1,
        values: rowValues,
      });
      isMock = result.isMock;
      return { ok: true, isMock, updated: true };
    } else {
      // 新規追加
      const result = await appendSheetRow({
        spreadsheetId,
        sheetName: SHEET_NAME,
        values: rowValues,
      });
      isMock = result.isMock;
      return { ok: true, isMock, updated: false };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[writeMemberMaster]", message);
    return { ok: false, error: message };
  }
}
