/**
 * POST /api/sheets/sync-all-team-dm
 *
 * アポインター別データシート（全チーム統合）の全月タブを走査し、
 * チーム別のDM数を team_monthly_aggregates.dm_count に保存する。
 *
 * Body: { year: number }
 *
 * 列マッピング（sheet_configs の設定に従う）:
 *   A列(teamColumn) = チーム名（辻利 / LUMIA / Covance）
 *   C列(dmCountColumn)  = DM数（数値）
 *
 * タブ名: "M月"（例: "1月", "4月" — ゼロ埋めなし）
 * データ開始行: sheet_configs.data_start_row（通常2）
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchSheetRange } from "@/lib/sheets/sheetsClient";

const TEAMS = ["辻利", "LUMIA", "Covance"] as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId || !["Admin", "AM"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { year } = await req.json();
  if (!year) {
    return NextResponse.json({ error: "year が必要です" }, { status: 400 });
  }

  // 全チーム統合シートの設定を取得
  const { data: cfg, error: cfgErr } = await supabaseAdmin
    .from("sheet_configs")
    .select("spreadsheet_id, team_column, dm_count_column, data_start_row")
    .eq("team", "全チーム")
    .single();

  if (cfgErr || !cfg) {
    return NextResponse.json(
      { error: "全チーム統合シートが設定されていません。Admin設定でURLを登録してください。" },
      { status: 404 }
    );
  }

  const spreadsheetId = cfg.spreadsheet_id as string;
  // A列インデックス（デフォルト0 = A列）
  const teamColLetter: string = (cfg.team_column as string | null) ?? "A";
  const dmColLetter:   string = (cfg.dm_count_column as string | null) ?? "C";
  const dataStartRow:  number = (cfg.data_start_row as number | null) ?? 2;

  // 列文字 → インデックス変換
  function colIndex(letter: string): number {
    const upper = letter.toUpperCase();
    let idx = 0;
    for (let i = 0; i < upper.length; i++) {
      idx = idx * 26 + (upper.charCodeAt(i) - 64);
    }
    return idx - 1;
  }
  const teamIdx = colIndex(teamColLetter);
  const dmIdx   = colIndex(dmColLetter);

  // 最大列インデックスから読み取り範囲を決定（A〜末尾まで）
  const maxIdx    = Math.max(teamIdx, dmIdx);
  const endColChar = String.fromCharCode(65 + maxIdx); // 最大26列想定
  const readRange  = `A${dataStartRow}:${endColChar}2000`;

  const results: {
    month: number;
    byTeam: Record<string, number>;
    skipped: boolean;
    error?: string;
  }[] = [];

  let isMock = false;
  const upsertRows: {
    year: number;
    month: number;
    team: string;
    dm_count: number;
  }[] = [];

  // 1月〜12月を順次処理
  for (let month = 1; month <= 12; month++) {
    const sheetName = `${month}月`;
    try {
      const { rows, isMock: mock } = await fetchSheetRange({
        spreadsheetId,
        sheetName,
        range: readRange,
      });
      if (mock) isMock = true;

      // チーム別DM集計
      const teamDm: Record<string, number> = {};
      for (const team of TEAMS) teamDm[team] = 0;
      let hasData = false;

      for (const row of rows) {
        const teamName = (row[teamIdx] ?? "").toString().trim();
        if (!TEAMS.includes(teamName as (typeof TEAMS)[number])) continue;
        const dmRaw = row[dmIdx];
        const dm    = typeof dmRaw === "number" ? dmRaw : parseInt(String(dmRaw ?? "").replace(/[,，\s]/g, "")) || 0;
        teamDm[teamName] += dm;
        hasData = true;
      }

      if (!hasData) {
        results.push({ month, byTeam: {}, skipped: true });
        continue;
      }

      for (const team of TEAMS) {
        upsertRows.push({ year, month, team, dm_count: teamDm[team] });
      }
      results.push({ month, byTeam: teamDm, skipped: false });
    } catch {
      // タブが存在しない月はスキップ
      results.push({ month, byTeam: {}, skipped: true, error: "タブなし" });
    }
  }

  if (upsertRows.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "同期できたデータがありません。シートのタブ名を確認してください（例: 1月, 4月）。",
      results,
    }, { status: 422 });
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("team_monthly_aggregates")
    .upsert(upsertRows, { onConflict: "year,month,team" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const syncedMonths = results.filter((r) => !r.skipped).map((r) => r.month);

  return NextResponse.json({
    ok: true,
    mockMode: isMock,
    year,
    syncedMonths,
    skippedMonths: results.filter((r) => r.skipped).map((r) => r.month),
    byMonth: Object.fromEntries(
      results.filter((r) => !r.skipped).map((r) => [r.month, r.byTeam])
    ),
  });
}
