/**
 * GET  /api/admin/evaluate?year=&month=   — 算出済み評価結果一覧
 * POST /api/admin/evaluate                — 評価結果を算出・保存
 * PATCH /api/admin/evaluate               — 個人への表示/非表示切替 or 一括配信
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

  // all_responded: 定性スコアが全て1点以上であれば回答済みと判定
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

  // 対象ユーザー（Appointer + AM）— team と education_mentor_user_id も取得
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, role, team, education_mentor_user_id")
    .in("role", ["Appointer", "AM"])
    .eq("setup_completed", true);

  if (!users || users.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const userIds = users.map((u) => u.id);

  // チームごとの営業マン一覧（FK joinなし）
  const { data: salesUsers } = await supabaseAdmin
    .from("users")
    .select("id, team")
    .eq("role", "Sales")
    .eq("setup_completed", true);

  // team → Sales IDセット
  const salesByTeam = new Map<string, Set<string>>();
  for (const s of salesUsers ?? []) {
    if (!s.team) continue;
    if (!salesByTeam.has(s.team)) salesByTeam.set(s.team, new Set());
    salesByTeam.get(s.team)!.add(s.id);
  }

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
    .select("respondent_id, q1_score, q2_score, q3_score, q4_score")
    .in("respondent_id", userIds)
    .eq("survey_type", "self")
    .eq("year", year)
    .eq("month", month);

  // 今月のアンケート回答（他者評価 — FK joinなし）
  const { data: evalAnswers } = await supabaseAdmin
    .from("survey_answers")
    .select("respondent_id, target_id, q1_score, q2_score, q3_score, q4_score")
    .in("target_id", userIds)
    .eq("survey_type", "eval")
    .eq("year", year)
    .eq("month", month);

  // target_id → 回答リスト（respondent_id付き）
  type EvalRow = { respondent_id: string; q1_score: number | null; q2_score: number | null; q3_score: number | null; q4_score: number | null };
  const evalByTarget = new Map<string, EvalRow[]>();
  for (const a of evalAnswers ?? []) {
    if (!evalByTarget.has(a.target_id)) evalByTarget.set(a.target_id, []);
    evalByTarget.get(a.target_id)!.push(a as EvalRow);
  }

  // 自己評価マップ
  const selfMap = new Map(
    (selfAnswers ?? []).map((a) => [a.respondent_id, a])
  );

  console.log("[evaluate] year=%d month=%d prevYear=%d prevMonth=%d", year, month, prevYear, prevMonth);
  console.log("[evaluate] users count=%d", users.length);
  console.log("[evaluate] salesUsers:", (salesUsers ?? []).map((s) => ({ id: s.id, team: s.team })));
  console.log("[evaluate] selfAnswers count=%d", (selfAnswers ?? []).length);
  console.log("[evaluate] evalAnswers count=%d", (evalAnswers ?? []).length);
  console.log("[evaluate] salesByTeam:", Object.fromEntries([...salesByTeam.entries()].map(([k, v]) => [k, [...v]])));

  const rows = users.map((u) => {
    const perf   = perfMap.get(u.id);
    const self   = selfMap.get(u.id);
    const evals  = evalByTarget.get(u.id) ?? [];
    const evalRespondentIds = new Set(evals.map((e) => e.respondent_id));

    const userTeam   = u.team ?? "";
    const salesInTeam = salesByTeam.get(userTeam) ?? new Set<string>();

    // ─── 3者回答チェック ────────────────────────────────────────────
    // Appointer: 本人(self) + 担当AM(eval) + チーム内全営業マン(eval) 全員必要
    // AM:        本人(self) + チーム内全営業マン(eval) 全員必要
    const hasSelf = !!self;

    let allRespondentsReady = false;

    if (u.role === "Appointer") {
      const amId = u.education_mentor_user_id;
      const hasAMEval    = amId ? evalRespondentIds.has(amId) : false;
      const missingSales = [...salesInTeam].filter((sid) => !evalRespondentIds.has(sid));
      const hasSalesEval = salesInTeam.size > 0 && missingSales.length === 0;
      allRespondentsReady = hasSelf && hasAMEval && hasSalesEval;
      console.log("[evaluate] Appointer %s: hasSelf=%s hasAMEval=%s (amId=%s) hasSalesEval=%s salesInTeam=%d evalRespondents=%s missingSales=%s => ready=%s",
        u.nickname ?? u.id, hasSelf, hasAMEval, amId, hasSalesEval, salesInTeam.size, [...evalRespondentIds].join(","), missingSales.join(","), allRespondentsReady);
    } else if (u.role === "AM") {
      const missingSales = [...salesInTeam].filter((sid) => !evalRespondentIds.has(sid));
      const hasSalesEval = salesInTeam.size > 0 && missingSales.length === 0;
      allRespondentsReady = hasSelf && hasSalesEval;
      console.log("[evaluate] AM %s: hasSelf=%s hasSalesEval=%s salesInTeam=%d evalRespondents=%s missingSales=%s => ready=%s",
        u.nickname ?? u.id, hasSelf, hasSalesEval, salesInTeam.size, [...evalRespondentIds].join(","), missingSales.join(","), allRespondentsReady);
    } else {
      allRespondentsReady = true;
    }

    // ─── 定量スコア（Appointerのみ） ────────────────────────────────
    const dmCount  = perf?.dm_count ?? null;
    const bSetRate = perf?.appointment_rate != null ? Number(perf.appointment_rate) : null;

    const workloadScore = u.role === "Appointer"
      ? (allRespondentsReady ? (dmCount  != null ? calcWorkload(dmCount)     : 1) : 0)
      : null;
    const performanceScore = u.role === "Appointer"
      ? (allRespondentsReady ? (bSetRate != null ? calcPerformance(bSetRate) : 1) : 0)
      : null;

    // ─── 定性スコア ──────────────────────────────────────────────────
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
      // _all_responded はDBに保存しない（計算用のみ）
      _all_responded:     allRespondentsReady,
    };
  });

  // DB upsert 用から _all_responded を除く
  const dbRows = rows.map(({ _all_responded: _, ...rest }) => rest);

  const { error } = await supabaseAdmin
    .from("evaluation_results")
    .upsert(dbRows, { onConflict: "year,month,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // レスポンスには all_responded を含める
  const responseRows = rows.map(({ _all_responded, ...rest }) => ({ ...rest, all_responded: _all_responded }));
  return NextResponse.json({
    ok: true,
    count: rows.length,
    results: responseRows,
    _debug: {
      year, month, prevYear, prevMonth,
      selfAnswerCount: selfAnswers?.length ?? 0,
      evalAnswerCount: evalAnswers?.length ?? 0,
      salesByTeam: Object.fromEntries([...salesByTeam.entries()].map(([k, v]) => [k, [...v]])),
      userSummary: rows.map(({ _all_responded, user_id, ...rest }) => ({
        user_id,
        all_responded: _all_responded,
        discipline_self: rest.discipline_self,
      })),
    },
  });
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
