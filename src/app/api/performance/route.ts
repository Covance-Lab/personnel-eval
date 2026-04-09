/**
 * GET  /api/performance  — 実績データ取得
 *   ?userId=UUID         — 特定ユーザーの全期間
 *   ?team=辻利&month=4&year=2026  — チーム今月分
 * POST /api/performance  — 実績データ一括登録（同期後の保存用）
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
  const userId = searchParams.get("userId");
  const team   = searchParams.get("team");
  const year   = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
  const month  = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;

  let query = supabaseAdmin
    .from("performance_records")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (userId) {
    // 本人 or AM/Admin のみ
    const isSelf = session.user.dbId === userId;
    const isPriv = ["Admin", "AM", "Bridge", "Closer"].includes(session.user.role);
    if (!isSelf && !isPriv) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("user_id", userId);
  } else if (team) {
    if (!["Admin", "AM", "Bridge", "Closer"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // AM は自チームのみ
    if (session.user.role === "AM" && session.user.team !== team) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("team", team);
    if (year)  query = query.eq("year", year);
    if (month) query = query.eq("month", month);
  } else {
    // パラメータなしの場合は本人のデータのみ返す
    query = query.eq("user_id", session.user.dbId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ records: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 同期はAdminのみ実行可能
  if (!["Admin", "AM"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { records } = await req.json();
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "records は配列で指定してください" }, { status: 400 });
  }

  // 実績レコードを Supabase に upsert（同じ user_id + year + month は上書き）
  const rows = records.map((r: {
    userId: string;
    sheetName?: string;
    year: number;
    month: number;
    dmCount?: number;
    appoCount?: number;
    appointmentRate?: number;
    income?: number;
    team?: string;
    syncedAt?: string;
  }) => ({
    user_id:          r.userId,
    sheet_name:       r.sheetName ?? null,
    year:             r.year,
    month:            r.month,
    dm_count:         r.dmCount ?? 0,
    appo_count:       r.appoCount ?? 0,
    appointment_rate: r.appointmentRate ?? 0,
    income:           r.income ?? 0,
    team:             r.team ?? null,
    synced_at:        r.syncedAt ?? new Date().toISOString(),
  }));

  const { data, error } = await supabaseAdmin
    .from("performance_records")
    .upsert(rows, { onConflict: "user_id,year,month" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: data?.length ?? 0 });
}

/**
 * PATCH /api/performance  — 期待月収の更新（本人のみ）
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { expectedIncome } = await req.json();
  if (typeof expectedIncome !== "number") {
    return NextResponse.json({ error: "expectedIncome (number) が必要です" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ expected_income: expectedIncome })
    .eq("id", session.user.dbId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
