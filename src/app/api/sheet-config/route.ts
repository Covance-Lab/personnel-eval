/**
 * GET /api/sheet-config?team=辻利  — シート設定取得
 * PUT /api/sheet-config            — シート設定保存（Admin のみ）
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractSpreadsheetId } from "@/types/performance";
import type { TeamGroup } from "@/types/user";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const team = new URL(req.url).searchParams.get("team");

  let query = supabaseAdmin.from("sheet_configs").select("*");
  if (team) query = query.eq("team", team);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // クライアントと互換性のある形式に変換
  const configs = (data ?? []).map(dbToConfig);
  return NextResponse.json({ configs });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { team, spreadsheetUrl, sheetName, columns } = body;

  if (!team || !spreadsheetUrl) {
    return NextResponse.json({ error: "team と spreadsheetUrl は必須です" }, { status: 400 });
  }

  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "URLからSpreadsheet IDを抽出できませんでした" },
      { status: 400 }
    );
  }

  const row = {
    team:               team as TeamGroup,
    spreadsheet_url:    spreadsheetUrl,
    spreadsheet_id:     spreadsheetId,
    sheet_name:         sheetName ?? "",
    name_column:        columns?.nameColumn         ?? "A",
    dm_count_column:    columns?.dmCountColumn       ?? "B",
    appo_count_column:  columns?.appoCountColumn     ?? "C",
    income_column:      columns?.incomeColumn        ?? "D",
    data_start_row:     columns?.dataStartRow        ?? 2,
    updated_at:         new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("sheet_configs")
    .upsert(row, { onConflict: "team" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: dbToConfig(data) });
}

// DB行をフロントエンド型 (SheetConfig) に変換
function dbToConfig(row: Record<string, unknown>) {
  return {
    team:             row.team,
    spreadsheetUrl:   row.spreadsheet_url,
    spreadsheetId:    row.spreadsheet_id,
    sheetName:        row.sheet_name ?? "",
    columns: {
      nameColumn:        row.name_column ?? "A",
      dmCountColumn:     row.dm_count_column ?? "B",
      appoCountColumn:   row.appo_count_column ?? "C",
      incomeColumn:      row.income_column ?? "D",
      dataStartRow:      row.data_start_row ?? 2,
    },
    updatedAt: row.updated_at,
  };
}
