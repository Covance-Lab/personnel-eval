/**
 * POST /api/sheets/sync-team-aggregate
 * 全体シートのデータ行（A列=チーム名）を読み取り、チーム別に集計して
 * team_monthly_aggregates テーブルに保存する
 *
 * Body: { year: number, month: number }
 *
 * 列マッピング（A列=index0）:
 *   A(0)  = チーム名
 *   F(5)  = B商談日時（記入あり = B設定）
 *   L(11) = B実施（"◎"）
 *   N(13) = A設定（"◎"）
 *   S(18) = A実施（"◎"）
 *   U(20) = 契約（"成約(全額着金)" or "成約(一部着金)"）
 *
 * データ行は17行目から開始
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchSheetRange } from "@/lib/sheets/sheetsClient";

const CONTRACT_VALUES = ["成約(全額着金)", "成約(一部着金)"];

function isCircle(v: string | undefined): boolean {
  return (v ?? "").trim() === "◎";
}

function hasValue(v: string | undefined): boolean {
  return (v ?? "").trim().length > 0;
}

interface TeamCount {
  bSetCount:    number;
  bExecCount:   number;
  aSetCount:    number;
  aExecCount:   number;
  contractCount: number;
}

function emptyCount(): TeamCount {
  return { bSetCount: 0, bExecCount: 0, aSetCount: 0, aExecCount: 0, contractCount: 0 };
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

  // 集計シートの設定を取得（全体シートと同じスプレッドシート）
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

  // A17:U1000 でデータ行を取得 + F7（全体DM数）・F8（全体B設定数）を取得
  let rows: string[][];
  let isMock = false;
  let overallDmCount = 0;
  let overallBSetFromSheet = 0;
  try {
    const [dataResult, summaryResult] = await Promise.all([
      fetchSheetRange({ spreadsheetId: cfg.spreadsheet_id, sheetName, range: "A17:U1000" }),
      fetchSheetRange({ spreadsheetId: cfg.spreadsheet_id, sheetName, range: "F7:F8" }),
    ]);
    rows = dataResult.rows;
    isMock = dataResult.isMock;
    // F7 = DM総計, F8 = B設定総計（ともに数値セル）
    overallDmCount       = parseInt((summaryResult.rows[0]?.[0] ?? "").replace(/[,，]/g, "")) || 0;
    overallBSetFromSheet = parseInt((summaryResult.rows[1]?.[0] ?? "").replace(/[,，]/g, "")) || 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // チーム別に集計
  const teamMap = new Map<string, TeamCount>();
  const overall = emptyCount();

  for (const row of rows) {
    const team = (row[0] ?? "").trim();
    if (!team) continue; // チーム名が空の行はスキップ

    if (!teamMap.has(team)) teamMap.set(team, emptyCount());
    const tc = teamMap.get(team)!;

    const bSet      = hasValue(row[5]);   // F列: B商談
    const bExec     = isCircle(row[11]);  // L列: B実施
    const aSet      = isCircle(row[13]);  // N列: A設定
    const aExec     = isCircle(row[18]);  // S列: A実施
    const contract  = CONTRACT_VALUES.includes((row[20] ?? "").trim()); // U列: 契約

    if (bSet)     { tc.bSetCount++;    overall.bSetCount++;    }
    if (bExec)    { tc.bExecCount++;   overall.bExecCount++;   }
    if (aSet)     { tc.aSetCount++;    overall.aSetCount++;    }
    if (aExec)    { tc.aExecCount++;   overall.aExecCount++;   }
    if (contract) { tc.contractCount++; overall.contractCount++; }
  }

  const syncedAt = new Date().toISOString();

  // チーム別 + "全体" 行を upsert
  const upsertRows = [
    { team: "全体", ...overall },
    ...Array.from(teamMap.entries()).map(([team, counts]) => ({ team, ...counts })),
  ].map(({ team, bSetCount, bExecCount, aSetCount, aExecCount, contractCount }) => ({
    year,
    month,
    team,
    // 全体行はシートF7/F8の値を優先、チーム行はdm_countなし
    ...(team === "全体" && overallDmCount > 0 ? { dm_count: overallDmCount } : {}),
    b_set_count:    team === "全体" && overallBSetFromSheet > 0 ? overallBSetFromSheet : bSetCount,
    b_exec_count:   bExecCount,
    a_set_count:    aSetCount,
    a_exec_count:   aExecCount,
    contract_count: contractCount,
    synced_at:      syncedAt,
  }));

  const { error: upsertErr } = await supabaseAdmin
    .from("team_monthly_aggregates")
    .upsert(upsertRows, { onConflict: "year,month,team" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // チーム別サマリーを返す
  const summary = Object.fromEntries(
    Array.from(teamMap.entries()).map(([team, counts]) => [team, counts])
  );

  return NextResponse.json({
    ok: true,
    mockMode: isMock,
    year,
    month,
    overall,
    byTeam: summary,
    rowCount: rows.filter((r) => (r[0] ?? "").trim()).length,
  });
}
