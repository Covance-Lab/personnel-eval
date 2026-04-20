/**
 * メンバーマスタシートへの書き込みロジック（サーバーサイド専用）
 *
 * 列構成:
 *   A: LINE ID (またはシステムユーザーID)
 *   B: フルネーム
 *   C: あだ名
 *   D: 役職
 *   E: チーム名
 *   F: 教育係名
 *   G: 登録日時
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchSheetRange, appendSheetRow, updateSheetRow } from "@/lib/sheets/sheetsClient";

const SHEET_NAME = "メンバーマスタ";

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
  // LINE IDが取れない場合はシステムユーザーIDで代替
  const lineId = (user.line_id as string | null) ?? (user.id as string);
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  const rowValues: (string | number)[] = [
    lineId,
    (user.name as string) ?? "",
    (user.nickname as string) ?? "",
    (user.role as string) ?? "",
    (user.team as string) ?? "",
    mentorName,
    now,
  ];

  try {
    // A列全体を取得して既存行を検索
    const { rows } = await fetchSheetRange({
      spreadsheetId,
      sheetName: SHEET_NAME,
      range: "A:A",
    });

    const existingRowIndex = rows.findIndex(
      (r) => String(r[0] ?? "").trim() === lineId
    );

    let isMock: boolean;
    if (existingRowIndex >= 0) {
      // 既存行を更新（1-indexed）
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
