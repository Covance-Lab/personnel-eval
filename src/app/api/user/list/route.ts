/**
 * GET /api/user/list — チーム・ロール別ユーザー一覧を取得
 * クエリパラメータ:
 *   team?    — '辻利' | 'LUMIA'
 *   role?    — 'Appointer' | 'AM' | ...
 *   fields?  — カンマ区切りの取得フィールド（デフォルト: id,nickname,name,team,role）
 *
 * Admin のみアクセス可能（AM は自チームのみ）
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

  let query = supabaseAdmin
    .from("users")
    .select(fieldParam)
    .eq("setup_completed", true);

  // AM は自チームのみ参照可能
  if (session.user.role === "AM" || session.user.role === "Bridge" || session.user.role === "Closer") {
    query = query.eq("team", session.user.team ?? "");
  } else if (teamParam) {
    query = query.eq("team", teamParam);
  }

  if (roleParam) {
    query = query.eq("role", roleParam);
  }

  const { data, error } = await query.order("nickname");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

/**
 * PATCH /api/user/list  — Admin がユーザーのロールを変更
 * Body: { userId: string, role: Role }
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
  if (role)  updates.role = role;
  if (team)  updates.team = team;

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
