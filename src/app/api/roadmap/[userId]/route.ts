/**
 * GET   /api/roadmap/[userId]  — ロードマップ取得（なければ自動作成）
 * PATCH /api/roadmap/[userId]  — ロードマップ更新
 *   AM/Admin: completed_step_count / deadlines_by_step_id / am_memo
 *   Sales/Admin: sales_memo（同チームのユーザーのみ）
 *
 * メモ表示ルール:
 *   am_memo    : 同チームのAM・営業マン・管理者のみ（アポインター本人は見えない）
 *   sales_memo : 同チームの営業マン・管理者のみ（AM本人・アポインターは見えない）
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
  const viewerRole = session.user.role;
  const viewerTeam = session.user.team;
  const isSelf     = session.user.dbId === userId;

  // 本人 or AM/Admin/Sales のみ参照可能
  const canRead = isSelf || ["Admin", "AM", "Bridge", "Closer", "Sales"].includes(viewerRole);
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ターゲットユーザー情報（チーム・ロール確認のため）
  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("role, team")
    .eq("id", userId)
    .single();

  const isSameTeam = viewerTeam && targetUser?.team && viewerTeam === targetUser.team;

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
        sales_memo: "",
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

  // メモ表示制御
  const result = { ...data };

  // アポインター本人: どちらのメモも見えない
  if (viewerRole === "Appointer") {
    result.am_memo = undefined;
    result.sales_memo = undefined;
  }
  // 他チームのAM・営業マン: メモ非表示
  else if (viewerRole !== "Admin" && !isSelf && !isSameTeam) {
    result.am_memo = undefined;
    result.sales_memo = undefined;
  }
  // AMが自分自身のロードマップを見る場合: sales_memoは非表示
  else if (viewerRole === "AM" && isSelf) {
    result.sales_memo = undefined;
  }
  // AMがターゲットAMのロードマップを見る場合（他AMのデータ）: sales_memo非表示
  else if (viewerRole === "AM" && targetUser?.role === "AM" && !isSelf) {
    result.sales_memo = undefined;
  }

  return NextResponse.json({ roadmap: result });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = await req.json();

  const viewerRole = session.user.role;
  const viewerTeam = session.user.team;
  const isAdmin    = viewerRole === "Admin";
  const isAM       = viewerRole === "AM";
  const isSales    = viewerRole === "Sales";
  const isSelf     = session.user.dbId === userId;

  if (!isAdmin && !isAM && !isSales && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Sales の場合: 同チームのユーザーのみ更新可
  if (isSales && !isAdmin) {
    const { data: targetUser } = await supabaseAdmin
      .from("users")
      .select("team")
      .eq("id", userId)
      .single();
    if (targetUser?.team !== viewerTeam) {
      return NextResponse.json({ error: "Forbidden: 別チームのユーザーは編集できません" }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = {};

  // AM/Admin のみ: ステップ数・期限・am_memo
  if (isAdmin || isAM) {
    if ("completed_step_count" in body) updates.completed_step_count = body.completed_step_count;
    if ("deadlines_by_step_id" in body) updates.deadlines_by_step_id = body.deadlines_by_step_id;
    if ("am_memo" in body)              updates.am_memo               = body.am_memo;
  }

  // Sales/Admin のみ: sales_memo
  if (isAdmin || isSales) {
    if ("sales_memo" in body) updates.sales_memo = body.sales_memo;
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
