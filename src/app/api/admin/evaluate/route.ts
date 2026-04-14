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
    .order("calculated_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // all_responded: 定性スコアが1つでも null or 0 以外であれば回答済みと判定
  const results = (data ?? []).map((r) => ({
    ...r,
    all_responded:
      r.discipline_self != null && r.discipline_self > 0 &&
      r.absorption_self != null && r.absorption_self > 0 &&
      r.contribution_self != null && r.contribution_self > 0 &&
      r.thinking_self != null && r.thinking_self > 0,
  }));

  return NextResponse.json({ results });
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

  // 今月のアンケート回答（他者評価）
  const { data: evalAnswers } = await supabaseAdmin
    .from("survey_answers")
    .select("respondent_id, target_id, q1_score, q2_score, q3_score, q4_score, respondent_role:respondent_id(role, team)")
    .in("target_id", userIds)
    .eq("survey_type", "eval")
    .eq("year", year)
    .eq("month", month);

  // 評価者のロール情報を取得（AMか営業マンか判別するため）
  const respondentIds = [...new Set((evalAnswers ?? []).map((a) => a.respondent_id))];
  const { data: respondentUsers } = respondentIds.length > 0
    ? await supabaseAdmin.from("users").select("id, role, team").in("id", respondentIds)
    : { data: [] };
  const respondentRoleMap = new Map((respondentUsers ?? []).map((u) => [u.id, { role: u.role as string, team: u.team as string | null }]));

  // target_id → 評価回答リスト（全体 / AMのみ / Salesのみ）
  const evalByTarget    = new Map<string, typeof evalAnswers>();
  const evalAMByTarget  = new Map<string, typeof evalAnswers>();
  const evalSalesByTarget = new Map<string, typeof evalAnswers>();
  for (const a of evalAnswers ?? []) {
    const resp = respondentRoleMap.get(a.respondent_id);
    if (!evalByTarget.has(a.target_id))     evalByTarget.set(a.target_id, []);
    evalByTarget.get(a.target_id)!.push(a);
    if (resp?.role === "AM") {
      if (!evalAMByTarget.has(a.target_id)) evalAMByTarget.set(a.target_id, []);
      evalAMByTarget.get(a.target_id)!.push(a);
    }
    if (resp?.role === "Sales") {
      if (!evalSalesByTarget.has(a.target_id)) evalSalesByTarget.set(a.target_id, []);
      evalSalesByTarget.get(a.target_id)!.push(a);
    }
  }

  // 自己評価マップ (respondent_id → 回答)
  const selfMap = new Map(
    (selfAnswers ?? []).map((a) => [a.respondent_id, a])
  );

  const rows = users.map((u) => {
    const perf  = perfMap.get(u.id);
    const self  = selfMap.get(u.id);
    const evals = evalByTarget.get(u.id) ?? [];
    const amEvals    = evalAMByTarget.get(u.id)    ?? [];
    const salesEvals = evalSalesByTarget.get(u.id) ?? [];

    // ─── 3者回答チェック ───────────────────────────────────
    // Appointer: 本人(self) + AM(eval) + 営業マン(eval) 全員必要
    // AM:        本人(self) + 営業マン(eval) が必要
    const hasSelf  = !!self;
    const hasAMEval    = amEvals.length > 0;
    const hasSalesEval = salesEvals.length > 0;

    const allRespondentsReady = u.role === "Appointer"
      ? hasSelf && hasAMEval && hasSalesEval
      : u.role === "AM"
      ? hasSelf && hasSalesEval
      : true;

    // ─── 定量スコア（Appointerのみ） ───────────────────────
    const dmCount    = perf?.dm_count    ?? null;
    const bSetRate   = perf?.appointment_rate != null ? Number(perf.appointment_rate) : null;
    const workloadScore   = u.role === "Appointer"
      ? (allRespondentsReady ? (dmCount   != null ? calcWorkload(dmCount)     : 1) : 0)
      : null;
    const performanceScore = u.role === "Appointer"
      ? (allRespondentsReady ? (bSetRate != null ? calcPerformance(bSetRate) : 1) : 0)
      : null;

    // ─── 定性スコア ─────────────────────────────────────────
    const disciplineSelf   = allRespondentsReady ? (self?.q1_score ?? null) : 0;
    const absorptionSelf   = allRespondentsReady ? (self?.q2_score ?? null) : 0;
    const contributionSelf = allRespondentsReady ? (self?.q3_score ?? null) : 0;
    const thinkingSelf     = allRespondentsReady ? (self?.q4_score ?? null) : 0;

    const disciplineOther   = allRespondentsReady ? avg(evals.map((e) => e.q1_score)) : 0;
    const absorptionOther   = allRespondentsReady ? avg(evals.map((e) => e.q2_score)) : 0;
    const contributionOther = allRespondentsReady ? avg(evals.map((e) => e.q3_score)) : 0;
    const thinkingOther     = allRespondentsReady ? avg(evals.map((e) => e.q4_score)) : 0;

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
      // all_responded はDBに保存せず返却のみ
      _all_responded:     allRespondentsReady,
    };
  });

  // DB upsert 用から _all_responded を除く
  const dbRows = rows.map(({ _all_responded: _, ...rest }) => rest);

  const { error } = await supabaseAdmin
    .from("evaluation_results")
    .upsert(dbRows, { onConflict: "year,month,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // レスポンスには all_responded を含める（_プレフィックスを外す）
  const responseRows = rows.map(({ _all_responded, ...rest }) => ({ ...rest, all_responded: _all_responded }));
  return NextResponse.json({ ok: true, count: rows.length, results: responseRows });
}

// ─── PATCH: 表示/非表示切替（個別 or 一括配信） ────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { year, month, userId, visibleToUser, publishAll } = body;

  if (!year || !month) {
    return NextResponse.json({ error: "year と month は必須です" }, { status: 400 });
  }

  // 一括配信モード
  if (publishAll === true) {
    const { error } = await supabaseAdmin
      .from("evaluation_results")
      .update({ visible_to_user: true })
      .eq("year", year)
      .eq("month", month);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, publishAll: true });
  }

  // 個別切替
  if (!userId || visibleToUser === undefined) {
    return NextResponse.json({ error: "userId と visibleToUser が必要です" }, { status: 400 });
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
