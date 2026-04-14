/**
 * GET /api/admin/debug-eval?year=&month=
 * 評価算出のデバッグ情報を返す（一時的なデバッグ用）
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const now   = new Date();
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));

  const prevDate  = new Date(year, month - 2, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  // 対象ユーザー
  const { data: users, error: usersError } = await supabaseAdmin
    .from("users")
    .select("id, nickname, name, role, team, education_mentor_user_id")
    .in("role", ["Appointer", "AM"])
    .eq("setup_completed", true);

  // Sales ユーザー
  const { data: salesUsers, error: salesError } = await supabaseAdmin
    .from("users")
    .select("id, nickname, name, team")
    .eq("role", "Sales")
    .eq("setup_completed", true);

  const userIds = (users ?? []).map((u) => u.id);

  // 自己評価アンケート
  const { data: selfAnswers, error: selfError } = await supabaseAdmin
    .from("survey_answers")
    .select("respondent_id, q1_score, q2_score, q3_score, q4_score")
    .in("respondent_id", userIds)
    .eq("survey_type", "self")
    .eq("year", year)
    .eq("month", month);

  // 他者評価アンケート
  const { data: evalAnswers, error: evalError } = await supabaseAdmin
    .from("survey_answers")
    .select("respondent_id, target_id, q1_score, q2_score, q3_score, q4_score")
    .in("target_id", userIds)
    .eq("survey_type", "eval")
    .eq("year", year)
    .eq("month", month);

  // salesByTeam マップ
  const salesByTeam: Record<string, string[]> = {};
  for (const s of salesUsers ?? []) {
    if (!s.team) continue;
    if (!salesByTeam[s.team]) salesByTeam[s.team] = [];
    salesByTeam[s.team].push(s.id);
  }

  // evalByTarget マップ
  const evalByTarget: Record<string, string[]> = {};
  for (const a of evalAnswers ?? []) {
    if (!evalByTarget[a.target_id]) evalByTarget[a.target_id] = [];
    evalByTarget[a.target_id].push(a.respondent_id);
  }

  const selfRespondentIds = new Set((selfAnswers ?? []).map((a) => a.respondent_id));

  // 各ユーザーのデバッグ情報
  const userDebug = (users ?? []).map((u) => {
    const userTeam    = u.team ?? "";
    const salesInTeam = salesByTeam[userTeam] ?? [];
    const evalResps   = evalByTarget[u.id] ?? [];
    const evalRespSet = new Set(evalResps);
    const hasSelf     = selfRespondentIds.has(u.id);

    let debug: Record<string, unknown> = {
      id: u.id,
      name: u.nickname ?? u.name,
      role: u.role,
      team: userTeam,
      hasSelf,
    };

    if (u.role === "Appointer") {
      const amId      = u.education_mentor_user_id;
      const hasAMEval = amId ? evalRespSet.has(amId) : false;
      const missingSales = salesInTeam.filter((sid) => !evalRespSet.has(sid));
      const hasSalesEval = salesInTeam.length > 0 && missingSales.length === 0;
      debug = {
        ...debug,
        education_mentor_user_id: amId,
        hasAMEval,
        salesInTeam,
        evalRespondents: evalResps,
        missingSalesEvals: missingSales,
        hasSalesEval,
        allRespondentsReady: hasSelf && hasAMEval && hasSalesEval,
      };
    } else if (u.role === "AM") {
      const missingSales = salesInTeam.filter((sid) => !evalRespSet.has(sid));
      const hasSalesEval = salesInTeam.length > 0 && missingSales.length === 0;
      debug = {
        ...debug,
        salesInTeam,
        evalRespondents: evalResps,
        missingSalesEvals: missingSales,
        hasSalesEval,
        allRespondentsReady: hasSelf && hasSalesEval,
      };
    }

    return debug;
  });

  return NextResponse.json({
    year, month,
    prevYear, prevMonth,
    usersError: usersError?.message,
    salesError: salesError?.message,
    selfError:  selfError?.message,
    evalError:  evalError?.message,
    salesUsers: (salesUsers ?? []).map((s) => ({ id: s.id, name: s.nickname ?? s.name, team: s.team })),
    salesByTeam,
    selfAnswerCount: (selfAnswers ?? []).length,
    evalAnswerCount: (evalAnswers ?? []).length,
    userDebug,
  });
}
