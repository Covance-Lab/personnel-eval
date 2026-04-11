/**
 * GET /api/hr
 * 人事評価ページ用: アポインター・AM一覧 + ロードマップ状態 + 当月離脱者
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["Admin", "AM", "Sales"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  // 前月
  const prevDate  = new Date(thisYear, thisMonth - 2, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  // アポインター・AM全員
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, nickname, name, role, team, line_picture_url, icon_image_url, setup_completed, created_at")
    .in("role", ["Appointer", "AM"])
    .eq("setup_completed", true)
    .order("team")
    .order("nickname");

  // ロードマップ
  const { data: roadmaps } = await supabaseAdmin
    .from("roadmaps")
    .select("user_id, completed_step_count");

  // 今月・前月の実績
  const { data: currPerf } = await supabaseAdmin
    .from("performance_records")
    .select("user_id, dm_count, appo_count")
    .eq("year", thisYear)
    .eq("month", thisMonth);

  const { data: prevPerf } = await supabaseAdmin
    .from("performance_records")
    .select("user_id, dm_count, appo_count")
    .eq("year", prevYear)
    .eq("month", prevMonth);

  // 離脱判定: 前月は実績あり(dm>0)、今月は実績なし or dm=0
  const prevActive = new Set(
    (prevPerf ?? [])
      .filter((r) => (r.dm_count ?? 0) > 0)
      .map((r) => r.user_id)
  );
  const currActive = new Set(
    (currPerf ?? [])
      .filter((r) => (r.dm_count ?? 0) > 0)
      .map((r) => r.user_id)
  );

  const roadmapMap = new Map(
    (roadmaps ?? []).map((r) => [r.user_id, r.completed_step_count as number])
  );
  const currPerfMap = new Map(
    (currPerf ?? []).map((r) => [r.user_id, r])
  );

  const enriched = (users ?? []).map((u) => {
    const stepCount = roadmapMap.get(u.id) ?? 0;
    const debuted   = stepCount >= 6; // 全6ステップ完了でデビュー済み
    const isChurned = prevActive.has(u.id) && !currActive.has(u.id);
    const perf      = currPerfMap.get(u.id);

    return {
      ...u,
      completedStepCount: stepCount,
      debuted,
      isChurned,
      dmCount:   perf?.dm_count   ?? 0,
      bSetCount: perf?.appo_count ?? 0,
    };
  });

  // ステータス集計
  const summary = {
    total:        enriched.filter((u) => u.role === "Appointer").length,
    debuted:      enriched.filter((u) => u.debuted && !u.isChurned).length,
    churned:      enriched.filter((u) => u.isChurned).length,
    preDebut:     Array.from({ length: 7 }, (_, i) => ({
      step: i,
      count: enriched.filter((u) => !u.debuted && u.completedStepCount === i && u.role === "Appointer").length,
    })),
  };

  return NextResponse.json({ users: enriched, summary });
}
