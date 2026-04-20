/**
 * POST /api/sheets/sync-aggregate
 * 集計シートから指定年月のデータを取得して monthly_aggregates に保存
 *
 * Body: { year: number, month: number }
 * 読み取るセル（固定）:
 *   F3  = 売上
 *   F9  = B実施数
 *   F10 = A設定数
 *   F11 = A実施数
 *   F12 = 契約数
 * シート（タブ）名: "MM月" (例: "03月", "04月")
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchSheetRange } from "@/lib/sheets/sheetsClient";

function parseNum(value: string | number | undefined): number {
  if (!value) return 0;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { year, month } = await req.json();
  if (!year || !month) {
    return NextResponse.json({ error: "year と month が必要です" }, { status: 400 });
  }

  // 該当年のスプレッドシート設定を取得
  const { data: cfg, error: cfgErr } = await supabaseAdmin
    .from("aggregate_sheet_configs")
    .select("spreadsheet_id")
    .eq("year", year)
    .single();

  if (cfgErr || !cfg) {
    return NextResponse.json(
      { error: `${year}年の集計シートが設定されていません` },
      { status: 404 }
    );
  }

  // タブ名: "MM月"
  const sheetName = `${String(month).padStart(2, "0")}月`;

  // F列を含む範囲を取得 (A1:F15 で十分)
  let rows: (string | number)[][];
  let isMock = false;
  try {
    const result = await fetchSheetRange({
      spreadsheetId: cfg.spreadsheet_id,
      sheetName,
      range: "A1:F15",
    });
    rows = result.rows;
    isMock = result.isMock;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 0-indexed: 行3→index2, 行9→index8, 行10→index9, 行11→index10, 行12→index11
  // F列 = index5
  const F = 5;
  const revenue       = parseNum(rows[2]?.[F]);   // F3
  const bExecCount    = parseNum(rows[8]?.[F]);   // F9
  const aSetCount     = parseNum(rows[9]?.[F]);   // F10
  const aExecCount    = parseNum(rows[10]?.[F]);  // F11
  const contractCount = parseNum(rows[11]?.[F]);  // F12

  const syncedAt = new Date().toISOString();

  const { error: upsertErr } = await supabaseAdmin
    .from("monthly_aggregates")
    .upsert(
      {
        year,
        month,
        b_exec_count:    bExecCount,
        a_set_count:     aSetCount,
        a_exec_count:    aExecCount,
        contract_count:  contractCount,
        revenue,
        synced_at:       syncedAt,
      },
      { onConflict: "year,month" }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mockMode: isMock,
    data: { year, month, revenue, bExecCount, aSetCount, aExecCount, contractCount },
  });
}
