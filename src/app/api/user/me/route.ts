/**
 * GET  /api/user/me  — 現在のログインユーザー情報を取得
 * PATCH /api/user/me — プロフィール更新（name, nickname, team, etc.）
 */

import { NextRequest, NextResponse } from "next/server";
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
  const allowedFields = [
    "name",
    "nickname",
    "team",
    "education_mentor_user_id",
    "setup_completed",
    "expected_income",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  // Admin 以外はロール変更不可
  if (session.user.role === "Admin" && "role" in body) {
    updates.role = body.role;
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

  return NextResponse.json({ user: data });
}
