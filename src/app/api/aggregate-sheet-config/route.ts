/**
 * GET  /api/aggregate-sheet-config        — 全年分の集計シート設定一覧
 * PUT  /api/aggregate-sheet-config        — 年ごとの集計シートURLを保存
 * DELETE /api/aggregate-sheet-config?year=YYYY — 削除
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function extractSpreadsheetId(urlOrId: string): string | null {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(urlOrId.trim())) return urlOrId.trim();
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.dbId || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("aggregate_sheet_configs")
    .select("*")
    .order("year", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { year, spreadsheetUrl } = await req.json();
  if (!year || !spreadsheetUrl) {
    return NextResponse.json({ error: "year と spreadsheetUrl が必要です" }, { status: 400 });
  }

  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    return NextResponse.json({ error: "無効なスプレッドシートURLです" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("aggregate_sheet_configs")
    .upsert(
      { year, spreadsheet_id: spreadsheetId, updated_at: new Date().toISOString() },
      { onConflict: "year" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  if (!year) return NextResponse.json({ error: "year が必要です" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("aggregate_sheet_configs")
    .delete()
    .eq("year", parseInt(year));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
