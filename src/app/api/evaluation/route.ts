/**
 * GET /api/evaluation?year=&month=&view=self|team
 *
 * view=self（デフォルト）
 *   自分の評価結果を1件返す（visible_to_user=trueのみ）
 *
 * view=team
 *   AM    → 自分 + 管轄アポインター全員の評価一覧
 *   Sales → 自チームのAM + そのAMが管轄するアポインター全員の評価一覧
 *   Admin → year/month の全評価一覧
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now   = new Date();
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
  const view  = searchParams.get("view") ?? "self";

  const myId   = session.user.dbId;
  const myRole = session.user.role;
  const myTeam = session.user.team;

  // ─── view=team ────────────────────────────────────────────────────────────
  if (view === "team") {
    // Admin/AM/Sales のみ許可
    if (!["Admin", "AM", "Sales"].includes(myRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let userIds: string[] = [];

    if (myRole === "Admin") {
      // 全ユーザー（year/monthで絞る）
      const { data: allUsers } = await supabaseAdmin
        .from("users")
        .select("id")
        .in("role", ["Appointer", "AM"])
        .eq("setup_completed", true);
      userIds = (allUsers ?? []).map((u) => u.id);

    } else if (myRole === "AM") {
      // 自分 + 管轄アポインター
      const { data: appointers } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("education_mentor_user_id", myId)
        .eq("role", "Appointer")
        .eq("setup_completed", true);
      userIds = [myId, ...(appointers ?? []).map((u) => u.id)];

    } else if (myRole === "Sales") {
      // 自チームのAM → そのAMが管轄するアポインター
      const { data: ams } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("role", "AM")
        .eq("team", myTeam)
        .eq("setup_completed", true);
      const amIds = (ams ?? []).map((u) => u.id);

      const { data: appointers } = amIds.length > 0
        ? await supabaseAdmin
            .from("users")
            .select("id")
            .in("education_mentor_user_id", amIds)
            .eq("role", "Appointer")
            .eq("setup_completed", true)
        : { data: [] };

      userIds = [...amIds, ...(appointers ?? []).map((u) => u.id)];
    }

    if (userIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("evaluation_results")
      .select("*, users(nickname, name, line_name, role, team)")
      .in("user_id", userIds)
      .eq("year", year)
      .eq("month", month)
      .eq("visible_to_user", true)
      .order("user_id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: data ?? [] });
  }

  // ─── view=self（デフォルト） ──────────────────────────────────────────────
  const { data, error } = await supabaseAdmin
    .from("evaluation_results")
    .select("*")
    .eq("user_id", myId)
    .eq("year", year)
    .eq("month", month)
    .eq("visible_to_user", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ result: data ?? null });
}
