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
  const teamParam     = searchParams.get("team");
  const roleParam     = searchParams.get("role");        // 単一ロール
  const rolesParam    = searchParams.get("roles");       // カンマ区切り複数ロール
  const mentorOfParam = searchParams.get("mentorOf");   // 担当アポインターIDでAMを逆引き
  const fieldParam    = searchParams.get("fields") ?? "id,nickname,name,team,role,setup_completed,line_picture_url";

  const userRole = session.user.role;
  const userTeam = session.user.team;
  const userId   = session.user.dbId;

  // アポインターが自分の担当AMを逆引き（自分の education_mentor_user_id を持つAMを取得）
  if (mentorOfParam) {
    // アポインター自身または Admin のみ許可
    if (userRole !== "Admin" && userId !== mentorOfParam) {
      return NextResponse.json({ users: [] });
    }
    // まずアポインター本人の education_mentor_user_id を取得
    const { data: appo } = await supabaseAdmin
      .from("users")
      .select("education_mentor_user_id")
      .eq("id", mentorOfParam)
      .single();
    if (!appo?.education_mentor_user_id) return NextResponse.json({ users: [] });
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(fieldParam)
      .eq("id", appo.education_mentor_user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data ?? [] });
  }

  let query = supabaseAdmin
    .from("users")
    .select(fieldParam)
    .eq("setup_completed", true);

  if (userRole === "Admin") {
    // Admin: 全チーム閲覧可。クエリパラメータでフィルタ可能
    if (teamParam) query = query.eq("team", teamParam);
  } else if (userRole === "Sales") {
    // 営業マン: 自チームのアポインター・AMのみ（+ rolesパラメータで自チームのSales/Closerも取得可）
    if (!userTeam) {
      return NextResponse.json({ users: [] });
    }
    if (rolesParam) {
      const roles = rolesParam.split(",").map((r) => r.trim());
      query = query.eq("team", userTeam).in("role", roles);
    } else {
      query = query.eq("team", userTeam).in("role", ["Appointer", "AM"]);
    }
  } else if (userRole === "AM") {
    // AM: 自分が教育係として紐付いているアポインターのみ
    query = query.eq("education_mentor_user_id", userId).eq("role", "Appointer");
  } else if (userRole === "Appointer") {
    // アポインター: 同チームのSales/Closerを閲覧可
    if (rolesParam && userTeam) {
      const roles = rolesParam.split(",").map((r) => r.trim());
      query = query.eq("team", userTeam).in("role", roles);
    } else {
      query = query.eq("id", userId);
    }
  } else {
    // その他: 自分のみ
    query = query.eq("id", userId);
  }

  if (roleParam && userRole === "Admin") {
    query = query.eq("role", roleParam);
  }
  if (rolesParam && userRole === "Admin") {
    const roles = rolesParam.split(",").map((r) => r.trim());
    query = query.in("role", roles);
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

  const { userId, role, team, educationMentorUserId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (team !== undefined) updates.team = team || null;
  // educationMentorUserId: null を明示的に渡した場合は解除、文字列の場合は設定
  if (educationMentorUserId !== undefined) {
    updates.education_mentor_user_id = educationMentorUserId || null;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select("id, role, team, nickname, education_mentor_user_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
