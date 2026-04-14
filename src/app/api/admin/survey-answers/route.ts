/**
 * GET /api/admin/survey-answers?year=&month=
 * 全ユーザーのアンケート回答を管理者向けに返す
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

  // 回答を取得（FK joinなし）
  const { data: rawAnswers, error } = await supabaseAdmin
    .from("survey_answers")
    .select("id, year, month, respondent_id, target_id, survey_type, q1_score, q1_reason, q2_score, q2_reason, q3_score, q3_reason, q4_score, q4_reason, submitted_at")
    .eq("year", year)
    .eq("month", month)
    .order("submitted_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!rawAnswers || rawAnswers.length === 0) {
    return NextResponse.json({ answers: [], year, month });
  }

  // 関連ユーザー情報を一括取得
  const allUserIds = [...new Set([
    ...rawAnswers.map((a) => a.respondent_id),
    ...rawAnswers.map((a) => a.target_id),
  ])];

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, nickname, name, role, team")
    .in("id", allUserIds);

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const answers = rawAnswers.map((a) => ({
    id:          a.id,
    year:        a.year,
    month:       a.month,
    survey_type: a.survey_type,
    q1_score:    a.q1_score,
    q1_reason:   a.q1_reason,
    q2_score:    a.q2_score,
    q2_reason:   a.q2_reason,
    q3_score:    a.q3_score,
    q3_reason:   a.q3_reason,
    q4_score:    a.q4_score,
    q4_reason:   a.q4_reason,
    submitted_at: a.submitted_at,
    respondent:  userMap.get(a.respondent_id) ?? null,
    target:      userMap.get(a.target_id)     ?? null,
  }));

  return NextResponse.json({ answers, year, month });
}
