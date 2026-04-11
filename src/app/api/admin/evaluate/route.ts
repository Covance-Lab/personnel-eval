/**
 * GET  /api/admin/evaluate?year=&month=   — 算出済み評価結果一覧
 * POST /api/admin/evaluate                — 評価結果を算出・保存
 * PATCH /api/admin/evaluate               — 個人への表示/非表示切替
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function calcWorkload(dm: number): number {
  if (dm >= 625) return 5;
  if (dm >= 500) return 4;
  if (dm >= 430) return 3;
  if (dm >= 375) return 2;
  return 1;
}

function calcPerformance(rate: number): number {
  if (rate >= 1.5) return 5;
  if (rate >= 1.2) return 4;
  if (rate >= 1.0) return 3;
  if (rate >= 0.3) return 2;
  return 1;
}

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null && n !== undefined);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((s, n) => s + n, 0) / valid.length) * 100) / 100;
}

// ─── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const now   = new Date();
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));

  const { data, error } = await supabaseAdmin
    .from("evaluation_results")
    .select("*, users(nickname, name, role, team)")
    .eq("year", year)
    .eq("month", month)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data ?? [] });
}

// ─── POST: 評価を算出・upsert ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body  = await req.json();
  const now   = new Date();
  const year  = body.year  ?? now.getFullYear();
  const month = body.month ?? (now.getMonth() + 1);

  // 前月（定量評価の基準月）
  const prevDate  = new Date(year, month - 2, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  // 対象ユーザー（Appointer + AM）
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .in("role", ["Appointer", "AM"])
    .eq("setup_completed", true);

  if (!users || users.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const userIds = users.map((u) => u.id);

  // 前月の実績データ（Appointer用定量評価）
  const { data: perfRecords } = await supabaseAdmin
    .from("performance_records")
    .select("user_id, dm_count, appo_count, appointment_rate")
    .in("user_id", userIds)
    .eq("year", prevYear)
    .eq("month", prevMonth);

  const perfMap = new Map(
    (perfRecords ?? []).map((r) => [r.user_id, r])
  );

  // 今月のアンケート回答（自己評価）
  const { data: selfAnswers } = await supabaseAdmin
    .from("survey_answers")
    .select("respondent_id, target_id, q1_score, q2_score, q3_score, q4_score")
    .in("respondent_id", userIds)
    .eq("survey_type", "self")
    .eq("year", year)
    .eq("month", month);

  // 今月のアンケート回答（他者評価 = 誰かがこのユーザーを評価したもの）
  const { data: evalAnswers } = await supabaseAdmin
    .from("survey_answers")
    .select("respondent_id, target_id, q1_score, q2_score, q3_score, q4_score")
    .in("target_id", userIds)
    .eq("survey_type", "eval")
    .eq("year", year)
    .eq("month", month);

  // target_id → 評価回答リスト
  const evalByTarget = new Map<string, typeof evalAnswers>();
  for (const a of evalAnswers ?? []) {
    if (!evalByTarget.has(a.target_id)) evalByTarget.set(a.target_id, []);
    evalByTarget.get(a.target_id)!.push(a);
  }

  // 自己評価マップ (respondent_id → 回答)
  const selfMap = new Map(
    (selfAnswers ?? []).map((a) => [a.respondent_id, a])
  );

  const rows = users.map((u) => {
    const perf = perfMap.get(u.id);
    const self = selfMap.get(u.id);
    const evals = evalByTarget.get(u.id) ?? [];

    // 定量スコア（Appointerのみ）
    const dmCount    = perf?.dm_count    ?? null;
    const appoCount  = perf?.appo_count  ?? null;
    const bSetRate   = perf?.appointment_rate != null ? Number(perf.appointment_rate) : null;
    const workloadScore   = u.role === "Appointer" && dmCount   != null ? calcWorkload(dmCount)     : null;
    const performanceScore = u.role === "Appointer" && bSetRate != null ? calcPerformance(bSetRate) : null;

    // 自己評価スコア
    const disciplineSelf   = self?.q1_score ?? null;
    const absorptionSelf   = self?.q2_score ?? null;
    const contributionSelf = self?.q3_score ?? null;
    const thinkingSelf     = self?.q4_score ?? null;

    // 他者評価スコア（平均）
    const disciplineOther   = avg(evals.map((e) => e.q1_score));
    const absorptionOther   = avg(evals.map((e) => e.q2_score));
    const contributionOther = avg(evals.map((e) => e.q3_score));
    const thinkingOther     = avg(evals.map((e) => e.q4_score));

    return {
      year, month,
      user_id:            u.id,
      workload_score:     workloadScore,
      performance_score:  performanceScore,
      dm_count:           dmCount,
      b_set_rate:         bSetRate,
      discipline_self:    disciplineSelf,
      absorption_self:    absorptionSelf,
      contribution_self:  contributionSelf,
      thinking_self:      thinkingSelf,
      discipline_other:   disciplineOther,
      absorption_other:   absorptionOther,
      contribution_other: contributionOther,
      thinking_other:     thinkingOther,
      visible_to_user:    false,
      calculated_at:      new Date().toISOString(),
    };
  });

  const { error } = await supabaseAdmin
    .from("evaluation_results")
    .upsert(rows, { onConflict: "year,month,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: rows.length });
}

// ─── PATCH: 表示/非表示切替 ────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { year, month, userId, visibleToUser } = body;

  if (!year || !month || !userId || visibleToUser === undefined) {
    return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("evaluation_results")
    .update({ visible_to_user: visibleToUser })
    .eq("year", year)
    .eq("month", month)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
