/**
 * GET  /api/sync-logs?team=辻利&limit=20  — 同期ログ取得
 * POST /api/sync-logs                     — 同期ログ保存
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const team  = searchParams.get("team");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  let query = supabaseAdmin
    .from("sync_logs")
    .select("*")
    .order("synced_at", { ascending: false })
    .limit(limit);

  if (team) query = query.eq("team", team);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // DB行をフロントエンド型 (SyncLog) に変換
  const logs = (data ?? []).map((row) => ({
    id:             row.id,
    team:           row.team,
    syncedAt:       row.synced_at,
    status:         row.status,
    processedCount: row.processed_count,
    skippedCount:   row.skipped_count,
    errorMessage:   row.error_message ?? undefined,
    mockMode:       row.mock_mode ?? false,
  }));

  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["Admin", "AM"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const log = await req.json();

  const { data, error } = await supabaseAdmin
    .from("sync_logs")
    .insert({
      team:            log.team,
      synced_at:       log.syncedAt ?? new Date().toISOString(),
      status:          log.status,
      processed_count: log.processedCount ?? 0,
      skipped_count:   log.skippedCount ?? 0,
      error_message:   log.errorMessage ?? null,
      mock_mode:       log.mockMode ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data });
}
