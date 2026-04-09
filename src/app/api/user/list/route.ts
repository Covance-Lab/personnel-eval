/**
 * GET /api/user/list — ロール別ユーザー一覧を取得
 *
 * 権限:
 *   Admin  — 全チーム全ユーザー閲覧可
 *   Sales  — 自分のチームのアポインター・AMのみ閲覧可
 *   AM     — 自分が education_mentor_user_id に設定されているアポインターのみ閲覧可
 *   その他 — 自分自身のみ
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
  const teamParam  = searchParams.get("team");
  const roleParam  = searchParams.get("role");
  const fieldParam = searchParams.get("fields") ?? "id,nickname,name,team,role,setup_completed,line_picture_url";

  const userRole = session.user.role;
  const userTeam = session.user.team;
  const userId   = session.user.dbId;

  let query = supabaseAdmin
    .from("users")
    .select(fieldParam)
    .eq("setup_completed", true);

  if (userRole === "Admin") {
    // Admin: 全チーム閲覧可。クエリパラメータでフィルタ可能
    if (teamParam) query = query.eq("team", teamParam);
  } else if (userRole === "Sales") {
    // 営業マン: 自チームのアポインター・AMのみ
    if (!userTeam) {
      return NextResponse.json({ users: [] });
    }
    query = query.eq("team", userTeam).in("role", ["Appointer", "AM"]);
  } else if (userRole === "AM") {
    // AM: 自分が教育係として紐付いているアポインターのみ
    query = query.eq("education_mentor_user_id", userId).eq("role", "Appointer");
  } else {
    // その他: 自分のみ
    query = query.eq("id", userId);
  }

  if (roleParam && userRole === "Admin") {
    query = query.eq("role", roleParam);
  }

  const { data, error } = await query.order("nickname");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

/**
 * PATCH /api/user/list  — Admin がユーザーのロール・チームを変更
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, role, team } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (team !== undefined) updates.team = team || null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select("id, role, team, nickname")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
