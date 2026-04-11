/**
 * テストユーザー管理 API（TEST_MODE=true のときのみ有効）
 *
 * GET    /api/test-users              — ユーザー一覧（認証不要）
 * POST   /api/test-users              — テストユーザー作成（Admin のみ）
 * DELETE /api/test-users?userId=xxx   — テストユーザー削除（Admin のみ）
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Role } from "@/types/user";

const isTestMode = process.env.TEST_MODE === "true";

// ─── GET: 全ユーザー一覧（ログイン画面用） ───────────────────────────────
export async function GET() {
  if (!isTestMode) {
    return NextResponse.json({ error: "TEST_MODE is not enabled" }, { status: 403 });
  }

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, nickname, name, line_name, role, team, setup_completed")
    .order("role")
    .order("team");

  return NextResponse.json({ users: users ?? [] });
}

// ─── POST: テストユーザー作成 ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isTestMode) {
    return NextResponse.json({ error: "TEST_MODE is not enabled" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, role, team } = await req.json();
  if (!name || !role) {
    return NextResponse.json({ error: "name と role は必須です" }, { status: 400 });
  }

  // test_ プレフィックスで一意な line_id を生成
  const fakeLineId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      line_id:          fakeLineId,
      line_name:        name,
      nickname:         name,
      role:             role as Role,
      team:             team || null,
      setup_completed:  true,
    })
    .select("id, nickname, role, team")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, user: data });
}

// ─── DELETE: テストユーザー削除 ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!isTestMode) {
    return NextResponse.json({ error: "TEST_MODE is not enabled" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId が必要です" }, { status: 400 });

  // 自分自身は削除不可
  if (userId === session.user.dbId) {
    return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("users").delete().eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
