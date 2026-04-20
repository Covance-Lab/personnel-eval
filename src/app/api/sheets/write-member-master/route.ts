/**
 * POST /api/sheets/write-member-master
 *
 * ユーザーの情報をGoogleスプレッドシートの「メンバーマスタ」タブに書き込む。
 * 既にLINE IDが存在する行があれば更新、なければ新規追加。
 *
 * 列構成（A列から）:
 *   A: LINE ID
 *   B: フルネーム
 *   C: あだ名
 *   D: 役職
 *   E: チーム名
 *   F: 教育係ユーザーID
 *   G: 登録日時
 *
 * スプレッドシートIDは sheet_configs の team="メンバーマスタ" から取得する。
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchSheetRange, appendSheetRow, updateSheetRow } from "@/lib/sheets/sheetsClient";

const SHEET_NAME = "メンバーマスタ";

export async function POST() {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.dbId;

  // ユーザー情報取得
  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, name, nickname, role, team, education_mentor_user_id, line_id, line_name")
    .eq("id", userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  // 教育係の名前を取得（任意）
  let mentorName = "";
  if (user.education_mentor_user_id) {
    const { data: mentor } = await supabaseAdmin
      .from("users")
      .select("nickname, name")
      .eq("id", user.education_mentor_user_id)
      .single();
    mentorName = mentor?.nickname ?? mentor?.name ?? user.education_mentor_user_id;
  }

  // メンバーマスタスプレッドシートの設定を取得
  const { data: cfg } = await supabaseAdmin
    .from("sheet_configs")
    .select("spreadsheet_id")
    .eq("team", "メンバーマスタ")
    .single();

  if (!cfg?.spreadsheet_id) {
    // 設定なし → スキップ（エラーにしない）
    return NextResponse.json({ ok: true, skipped: true, reason: "メンバーマスタシート未設定" });
  }

  const spreadsheetId = cfg.spreadsheet_id as string;
  const lineId = (user.line_id as string | null) ?? userId;
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  const rowValues = [
    lineId,
    (user.name as string) ?? "",
    (user.nickname as string) ?? "",
    (user.role as string) ?? "",
    (user.team as string) ?? "",
    mentorName,
    now,
  ];

  try {
    // 既存行を検索（A列 = LINE ID）
    const { rows } = await fetchSheetRange({
      spreadsheetId,
      sheetName: SHEET_NAME,
      range: "A:A",
    });

    const existingRowIndex = rows.findIndex((r) => String(r[0] ?? "").trim() === lineId);

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
    } else {
      // 新規追加
      const result = await appendSheetRow({
        spreadsheetId,
        sheetName: SHEET_NAME,
        values: rowValues,
      });
      isMock = result.isMock;
    }

    return NextResponse.json({ ok: true, isMock, updated: existingRowIndex >= 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // 書き込みエラーはログだけしてもユーザーのセットアップは維持
    console.error("[write-member-master]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
