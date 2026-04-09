/**
 * GET  /api/performance  — 実績データ取得
 *
 * 権限:
 *   Admin  — 全件取得可
 *   Sales  — 自チームのアポインターの実績のみ
 *   AM     — 自分が教育係のアポインターの実績のみ
 *   Appointer — 自分自身のみ
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

  const userRole = session.user.role;
  const userTeam = session.user.team;
  const dbId     = session.user.dbId;

  let query = supabaseAdmin
    .from("performance_records")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (userId) {
    // 特定ユーザーの実績: 本人 or 権限者のみ
    const isSelf = dbId === userId;
    const isPriv = ["Admin", "AM", "Sales"].includes(userRole);
    if (!isSelf && !isPriv) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // AM は自分が管轄するアポインターのみ
    if (userRole === "AM") {
      const { data: target } = await supabaseAdmin
        .from("users")
        .select("education_mentor_user_id")
        .eq("id", userId)
        .single();
      if (target?.education_mentor_user_id !== dbId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // 営業マンは自チームのみ
    if (userRole === "Sales") {
      const { data: target } = await supabaseAdmin
        .from("users")
        .select("team")
        .eq("id", userId)
        .single();
      if (target?.team !== userTeam) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    query = query.eq("user_id", userId);
  } else if (team) {
    if (!["Admin", "Sales"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (userRole === "Sales" && userTeam !== team) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("team", team);
    if (year)  query = query.eq("year", year);
    if (month) query = query.eq("month", month);
  } else {
    // パラメータなし
    if (userRole === "Admin") {
      // Admin: 全件
    } else if (userRole === "Sales") {
      // 営業マン: 自チームのアポインターの実績
      if (!userTeam) return NextResponse.json({ records: [] });
      const { data: teamUsers } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("team", userTeam)
        .eq("role", "Appointer");
      const ids = (teamUsers ?? []).map((u: { id: string }) => u.id);
      if (ids.length === 0) return NextResponse.json({ records: [] });
      query = query.in("user_id", ids);
    } else if (userRole === "AM") {
      // AM: 自分が管轄するアポインターの実績
      const { data: myAppointers } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("education_mentor_user_id", dbId)
        .eq("role", "Appointer");
      const ids = (myAppointers ?? []).map((u: { id: string }) => u.id);
      if (ids.length === 0) return NextResponse.json({ records: [] });
      query = query.in("user_id", ids);
    } else {
      // その他: 自分のみ
      query = query.eq("user_id", dbId);
    }
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

  if (!["Admin", "AM"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { records } = await req.json();
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "records は配列で指定してください" }, { status: 400 });
  }

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
