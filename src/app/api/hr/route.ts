/**
 * GET /api/hr
 * 人事評価ページ用: アポインター・AM一覧 + ロードマップ状態 + 当月離脱者
 * Sales の場合は自チームのみ返す
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

  const myRole = session.user.role;
  const myTeam = session.user.team;

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  // 前月
  const prevDate  = new Date(thisYear, thisMonth - 2, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  // Sales: 自チームのAM＋そのアポインターのみ
  let targetIds: string[] | null = null;
  if (myRole === "Sales" && myTeam) {
    const { data: teamAMs } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("role", "AM")
      .eq("team", myTeam)
      .eq("setup_completed", true);

    const amIds = (teamAMs ?? []).map((u) => u.id);

    const { data: teamAppointers } = amIds.length > 0
      ? await supabaseAdmin
          .from("users")
          .select("id")
          .in("education_mentor_user_id", amIds)
          .eq("role", "Appointer")
          .eq("setup_completed", true)
      : { data: [] };

    targetIds = [...amIds, ...(teamAppointers ?? []).map((u) => u.id)];
  }

  // アポインター・AM取得
  let usersQuery = supabaseAdmin
    .from("users")
    .select("id, nickname, name, role, team, line_picture_url, icon_image_url, setup_completed, created_at, education_mentor_user_id")
    .in("role", ["Appointer", "AM"])
    .eq("setup_completed", true)
    .order("team")
    .order("nickname");

  if (targetIds !== null) {
    usersQuery = usersQuery.in("id", targetIds);
  }

  const { data: users } = await usersQuery;

  // ロードマップ（am_memo含む）
  const { data: roadmaps } = await supabaseAdmin
    .from("roadmaps")
    .select("user_id, completed_step_count, am_memo");

  // 今月・前月の実績
  const { data: currPerf } = await supabaseAdmin
    .from("performance_records")
    .select("user_id, dm_count, appo_count, appointment_rate")
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
    (roadmaps ?? []).map((r) => [r.user_id, r])
  );
  const currPerfMap = new Map(
    (currPerf ?? []).map((r) => [r.user_id, r])
  );

  // AMのID→ニックネームマップ（アポインターのAM名表示用）
  const amMap = new Map(
    (users ?? [])
      .filter((u) => u.role === "AM")
      .map((u) => [u.id, u.nickname ?? u.name ?? u.id])
  );

  const enriched = (users ?? []).map((u) => {
    const roadmap   = roadmapMap.get(u.id);
    const stepCount = roadmap?.completed_step_count ?? 0;
    const debuted   = stepCount >= 6;
    const isChurned = prevActive.has(u.id) && !currActive.has(u.id);
    const perf      = currPerfMap.get(u.id);

    return {
      ...u,
      completedStepCount:   stepCount,
      debuted,
      isChurned,
      dmCount:              perf?.dm_count         ?? 0,
      bSetCount:            perf?.appo_count        ?? 0,
      bSetRate:             perf?.appointment_rate != null ? Number(perf.appointment_rate) : null,
      amMemo:               roadmap?.am_memo        ?? "",
      amName:               u.education_mentor_user_id ? (amMap.get(u.education_mentor_user_id) ?? null) : null,
    };
  });

  // Appointerのみでサマリー計算
  const appointers = enriched.filter((u) => u.role === "Appointer");
  const summary = {
    total:   appointers.length,
    debuted: appointers.filter((u) => u.debuted && !u.isChurned).length,
    churned: appointers.filter((u) => u.isChurned).length,
    preDebut: Array.from({ length: 7 }, (_, i) => ({
      step: i,
      count: appointers.filter((u) => !u.debuted && u.completedStepCount === i).length,
    })),
  };

  return NextResponse.json({ users: enriched, summary });
}
