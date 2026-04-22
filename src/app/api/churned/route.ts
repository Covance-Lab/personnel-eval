/**
 * GET /api/churned
 * 離脱アポインター一覧・統計を返す
 * PATCH /api/churned  — 離脱原因を保存
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROADMAP_STEPS } from "@/types/roadmap";

function getPhaseLabel(stepCount: number): string {
  if (stepCount < 4)  return "Phase 1";
  if (stepCount < 7)  return "Phase 2";
  if (stepCount < 12) return "Phase 3";
  return "Phase 4";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role;
  const team = session.user.team;
  if (!["Admin", "AM", "AM_Sales", "Sales"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 離脱ユーザー取得（churned_at が設定されているアポインター）
  let query = supabaseAdmin
    .from("users")
    .select("id, nickname, name, role, team, line_picture_url, icon_image_url, churned_at, created_at, age, gender, hobbies, self_introduction, featured_image_1_url, featured_image_2_url")
    .eq("role", "Appointer")
    .not("churned_at", "is", null)
    .order("churned_at", { ascending: false });

  // Sales / AM_Sales: 自チームのみ
  if ((role === "Sales" || role === "AM_Sales") && team) {
    query = query.eq("team", team);
  }
  // AM: 自分が教育係のアポインターのみ
  if (role === "AM") {
    query = query.eq("education_mentor_user_id", session.user.dbId);
  }

  const { data: churnedUsers } = await query;

  if (!churnedUsers || churnedUsers.length === 0) {
    return NextResponse.json({ users: [], stats: { total: 0, avgDays: null, phaseCount: [], reasonCount: [] } });
  }

  const userIds = churnedUsers.map((u) => u.id);

  // ロードマップ取得（採用日・ステップ数・離脱原因）
  const { data: roadmaps } = await supabaseAdmin
    .from("roadmaps")
    .select("user_id, registered_at, completed_step_count, churned_reason")
    .in("user_id", userIds);

  const roadmapMap = new Map((roadmaps ?? []).map((r) => [r.user_id, r]));

  const enriched = churnedUsers.map((u) => {
    const rm = roadmapMap.get(u.id);
    const registeredAt = rm?.registered_at ?? null;
    const churnedAt    = u.churned_at as string;
    const stepCount    = rm?.completed_step_count ?? 0;

    // 採用〜離脱の日数
    let daysUntilChurn: number | null = null;
    if (registeredAt && churnedAt) {
      const diff = new Date(churnedAt).getTime() - new Date(registeredAt).getTime();
      daysUntilChurn = Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
    }

    return {
      id:             u.id,
      nickname:       u.nickname,
      name:           u.name,
      team:           u.team,
      line_picture_url: u.line_picture_url,
      icon_image_url:   u.icon_image_url,
      churned_at:     churnedAt,
      registered_at:  registeredAt,
      completedStepCount: stepCount,
      phaseLabel:     getPhaseLabel(stepCount),
      stepLabel:      stepCount >= ROADMAP_STEPS.length ? "デビュー後" : `STEP${stepCount}完了`,
      daysUntilChurn,
      churnedReason:  rm?.churned_reason ?? "",
      age:            (u as Record<string, unknown>).age as number | null ?? null,
      gender:         (u as Record<string, unknown>).gender as string | null ?? null,
      hobbies:        (u as Record<string, unknown>).hobbies as string | null ?? null,
      self_introduction: (u as Record<string, unknown>).self_introduction as string | null ?? null,
      featured_image_1_url: (u as Record<string, unknown>).featured_image_1_url as string | null ?? null,
      featured_image_2_url: (u as Record<string, unknown>).featured_image_2_url as string | null ?? null,
    };
  });

  // 統計計算
  const total    = enriched.length;
  const days     = enriched.map((u) => u.daysUntilChurn).filter((d): d is number => d !== null);
  const avgDays  = days.length > 0 ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : null;

  const phaseMap = new Map<string, number>();
  enriched.forEach((u) => {
    phaseMap.set(u.phaseLabel, (phaseMap.get(u.phaseLabel) ?? 0) + 1);
  });
  const phaseCount = ["Phase 1", "Phase 2", "Phase 3", "Phase 4"].map((p) => ({
    phase: p,
    count: phaseMap.get(p) ?? 0,
  }));

  // 離脱原因集計
  const reasonMap = new Map<string, number>();
  enriched.forEach((u) => {
    const r = u.churnedReason?.trim();
    if (r) reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  });
  const reasonCount = Array.from(reasonMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));

  return NextResponse.json({ users: enriched, stats: { total, avgDays, phaseCount, reasonCount } });
}

// 離脱原因を保存
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["Admin", "AM", "AM_Sales", "Sales"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, churnedReason } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("roadmaps")
    .update({ churned_reason: churnedReason ?? "" })
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
