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

  // 全回答を取得（respondent / target の名前付き）
  const { data: answers, error } = await supabaseAdmin
    .from("survey_answers")
    .select(`
      id,
      year, month,
      survey_type,
      q1_score, q1_reason,
      q2_score, q2_reason,
      q3_score, q3_reason,
      q4_score, q4_reason,
      submitted_at,
      respondent:respondent_id ( id, nickname, name, role, team ),
      target:target_id         ( id, nickname, name, role, team )
    `)
    .eq("year", year)
    .eq("month", month)
    .order("submitted_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ answers: answers ?? [], year, month });
}
