/**
 * POST /api/sheets/sync
 *
 * Google Sheets からデータを取得し、Supabase に直接保存する（認証必須）。
 * シート設定は DB から取得するため、クライアントから config を渡す必要はない。
 *
 * Body:
 *   team    TeamGroup   対象チーム ("辻利" | "LUMIA")
 *   year?   number      対象年 (省略時: 今月)
 *   month?  number      対象月 (省略時: 今月)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runSyncService } from "@/lib/sheets/syncService";
import type { SheetConfig } from "@/types/performance";
import type { TeamGroup } from "@/types/user";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!["Admin", "AM"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: { team: TeamGroup; year?: number; month?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { team, year, month } = body;
  if (!team) {
    return NextResponse.json({ ok: false, error: "team は必須です" }, { status: 400 });
  }

  const now = new Date();
  const targetYear  = year  ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth() + 1;

  // ─── 1. DB からシート設定を取得 ──────────────────────────────
  const { data: cfgRow, error: cfgErr } = await supabaseAdmin
    .from("sheet_configs")
    .select("*")
    .eq("team", team)
    .single();

  if (cfgErr || !cfgRow) {
    return NextResponse.json(
      { ok: false, error: `${team} のシート設定が見つかりません。Admin設定でURLを登録してください。` },
      { status: 404 }
    );
  }

  const config: SheetConfig = {
    team:           cfgRow.team,
    spreadsheetUrl: cfgRow.spreadsheet_url,
    spreadsheetId:  cfgRow.spreadsheet_id,
    sheetName:      cfgRow.sheet_name ?? "",
    columns: {
      nameColumn:       cfgRow.name_column      ?? "A",
      dmCountColumn:    cfgRow.dm_count_column   ?? "B",
      appoCountColumn:  cfgRow.appo_count_column ?? "C",
      incomeColumn:     cfgRow.income_column     ?? "D",
      dataStartRow:     cfgRow.data_start_row    ?? 2,
    },
    updatedAt: cfgRow.updated_at,
  };

  // ─── 2. DB からアポインターのユーザーマッピングを取得 ─────────
  const { data: appoUsers } = await supabaseAdmin
    .from("users")
    .select("id, nickname, name")
    .eq("team", team)
    .eq("role", "Appointer")
    .eq("setup_completed", true);

  const userMappings = (appoUsers ?? []).map((u: { id: string; nickname?: string; name?: string }) => ({
    userId:   u.id,
    nickname: u.nickname ?? u.id,
    name:     u.name     ?? u.id,
  }));

  // ─── 3. Sheets 同期実行 ─────────────────────────────────────
  let result;
  try {
    result = await runSyncService({ config, userMappings, year: targetYear, month: targetMonth, team });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  // ─── 4. 実績データを Supabase に保存 ─────────────────────────
  if (result.ok && result.records.length > 0) {
    const rows = result.records.map((r) => ({
      user_id:          r.userId,
      sheet_name:       r.sheetName ?? null,
      year:             r.year,
      month:            r.month,
      dm_count:         r.dmCount,
      appo_count:       r.appoCount,
      appointment_rate: r.appointmentRate,
      income:           r.income,
      team:             r.team,
      synced_at:        r.syncedAt,
    }));

    const { error: upsertErr } = await supabaseAdmin
      .from("performance_records")
      .upsert(rows, { onConflict: "user_id,year,month" });

    if (upsertErr) {
      console.error("[sheets/sync] upsert error:", upsertErr);
    }
  }

  // ─── 5. 同期ログを Supabase に保存 ───────────────────────────
  await supabaseAdmin.from("sync_logs").insert({
    team:            result.log.team,
    synced_at:       result.log.syncedAt,
    status:          result.log.status,
    processed_count: result.log.processedCount,
    skipped_count:   result.log.skippedCount,
    error_message:   result.log.errorMessage ?? null,
    mock_mode:       result.mockMode,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
