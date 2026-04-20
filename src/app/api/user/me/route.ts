/**
 * GET  /api/user/me  — 現在のログインユーザー情報を取得
 * PATCH /api/user/me — プロフィール更新（name, nickname, team, etc.）
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { writeMemberMaster } from "@/lib/sheets/writeMemberMaster";

export async function GET() {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", session.user.dbId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { data: currentUser } = await supabaseAdmin
    .from("users")
    .select("role, setup_completed")
    .eq("id", session.user.dbId)
    .single();

  const allowedFields = [
    "name",
    "nickname",
    "role",
    "team",
    "education_mentor_user_id",
    "setup_completed",
    "age",
    "gender",
    "hobbies",
    "self_introduction",
    "icon_image_url",
    "featured_image_1_url",
    "featured_image_2_url",
    "expected_income",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  // role変更は Admin か、初期設定未完了ユーザーのみ許可
  if ("role" in body) {
    const canUpdateRole =
      session.user.role === "Admin" || currentUser?.setup_completed === false;
    if (!canUpdateRole) {
      return NextResponse.json({ error: "Role update is not allowed" }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", session.user.dbId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // セットアップ完了時（初回 or 再設定）: メンバーマスタに書き込む
  // レスポンスを遅らせないよう非同期で実行（エラーはログのみ）
  if (body.setup_completed === true) {
    writeMemberMaster(session.user.dbId).catch((e) =>
      console.error("[user/me] writeMemberMaster failed:", e)
    );
  }

  return NextResponse.json({ user: data });
}
