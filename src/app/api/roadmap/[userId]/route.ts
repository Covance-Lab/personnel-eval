/**
 * GET   /api/roadmap/[userId]  — ロードマップ取得（なければ自動作成）
 * PATCH /api/roadmap/[userId]  — ロードマップ更新（AM/Admin のみ completedStepCount/memo を変更可）
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  // 本人 or AM/Admin のみ参照可能
  const isSelf   = session.user.dbId === userId;
  const canRead  = isSelf || ["Admin", "AM", "Bridge", "Closer"].includes(session.user.role);
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let { data, error } = await supabaseAdmin
    .from("roadmaps")
    .select("*")
    .eq("user_id", userId)
    .single();

  // 存在しなければ初期化して返す
  if (error?.code === "PGRST116" || !data) {
    const initResult = await supabaseAdmin
      .from("roadmaps")
      .insert({
        user_id: userId,
        registered_at: new Date().toISOString(),
        completed_step_count: 0,
        deadlines_by_step_id: {},
        am_memo: "",
      })
      .select()
      .single();

    if (initResult.error) {
      return NextResponse.json({ error: initResult.error.message }, { status: 500 });
    }
    data = initResult.data;
    error = null;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ roadmap: data });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = await req.json();

  const isAdmin = session.user.role === "Admin";
  const isAM    = session.user.role === "AM";
  const isSelf  = session.user.dbId === userId;

  if (!isAdmin && !isAM && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};

  // AM/Admin のみ: ステップ数・期限・メモを変更可
  if (isAdmin || isAM) {
    if ("completed_step_count" in body) updates.completed_step_count = body.completed_step_count;
    if ("deadlines_by_step_id" in body) updates.deadlines_by_step_id = body.deadlines_by_step_id;
    if ("am_memo" in body)              updates.am_memo               = body.am_memo;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("roadmaps")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ roadmap: data });
}
