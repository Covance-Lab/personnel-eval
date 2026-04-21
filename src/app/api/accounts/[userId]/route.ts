/**
 * GET  /api/accounts/[userId]  — アカウント一覧取得
 * PUT  /api/accounts/[userId]  — アカウント一覧保存（全スロット上書き）
 *
 * 権限:
 *   本人: 自分のアカウントを読み書き可能
 *   AM: 自分管轄のアポインターのアカウントを閲覧可能
 *   Sales: 自チームのアポインター・AMのアカウントを閲覧可能
 *   Admin: 全員閲覧可能
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
  const viewerId   = session.user.dbId;
  const isSelf     = viewerId === userId;

  // アクセス権チェック
  if (!isSelf) {
    if (!["Admin", "AM", "Sales", "Bridge", "Closer"].includes(viewerRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // AM: 自分が教育係のアポインターのみ
    if (viewerRole === "AM") {
      const { data: target } = await supabaseAdmin
        .from("users")
        .select("education_mentor_user_id")
        .eq("id", userId)
        .single();
      if (target?.education_mentor_user_id !== viewerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Sales: 自チームのみ
    if (viewerRole === "Sales") {
      const { data: target } = await supabaseAdmin
        .from("users")
        .select("team")
        .eq("id", userId)
        .single();
      if (target?.team !== viewerTeam) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from("user_accounts")
    .select("slot, url, status")
    .eq("user_id", userId)
    .order("slot");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data ?? [] });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const isSelf = session.user.dbId === userId;

  // 本人のみ書き込み可
  if (!isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const accounts: { slot: number; url: string; status: string }[] = body.accounts ?? [];

  // バリデーション
  if (!Array.isArray(accounts) || accounts.some((a) => a.slot < 1 || a.slot > 10)) {
    return NextResponse.json({ error: "Invalid accounts data" }, { status: 400 });
  }

  // upsert（空URLのスロットは削除、URLがあるものはupsert）
  const toUpsert = accounts
    .filter((a) => a.url?.trim())
    .map((a) => ({
      user_id: userId,
      slot: a.slot,
      url: a.url.trim(),
      status: a.status || "使用中（DM送信）",
      updated_at: new Date().toISOString(),
    }));

  const toDelete = accounts
    .filter((a) => !a.url?.trim())
    .map((a) => a.slot);

  if (toUpsert.length > 0) {
    const { error: upsertErr } = await supabaseAdmin
      .from("user_accounts")
      .upsert(toUpsert, { onConflict: "user_id,slot" });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  if (toDelete.length > 0) {
    const { error: delErr } = await supabaseAdmin
      .from("user_accounts")
      .delete()
      .eq("user_id", userId)
      .in("slot", toDelete);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // 保存後の最新データを返す
  const { data, error } = await supabaseAdmin
    .from("user_accounts")
    .select("slot, url, status")
    .eq("user_id", userId)
    .order("slot");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ accounts: data ?? [] });
}
