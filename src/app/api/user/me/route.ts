/**
 * GET  /api/user/me  — 現在のログインユーザー情報を取得
 * PATCH /api/user/me — プロフィール更新（name, nickname, team, etc.）
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  // 初回セットアップ完了時: メンバーマスタに非同期書き込み（失敗してもレスポンスには影響しない）
  const isSettingupComplete = body.setup_completed === true && !currentUser?.setup_completed;
  if (isSettingupComplete) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    fetch(`${baseUrl}/api/sheets/write-member-master`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: req.headers.get("cookie") ?? "" },
    }).catch((e) => console.error("[user/me] write-member-master failed:", e));
  }

  return NextResponse.json({ user: data });
}
