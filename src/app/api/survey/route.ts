/**
 * GET  /api/survey?year=&month=   — 提出状況確認（ロール別）
 * POST /api/survey                — 1ページ分の回答を保存
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

  const myId   = session.user.dbId;
  const myRole = session.user.role;
  const myTeam = session.user.team;

  // 自分が提出済みの回答を取得（テーブル未作成時はエラーを無視）
  const { data: submitted, error: submittedErr } = await supabaseAdmin
    .from("survey_answers")
    .select("target_id, survey_type, submitted_at")
    .eq("respondent_id", myId)
    .eq("year", year)
    .eq("month", month);

  // テーブルが存在しない場合は全て未提出として続行（pages生成はスキップしない）
  const submittedMap = new Map(
    submittedErr
      ? [] // エラー時は空マップ（全て未提出扱い）
      : (submitted ?? []).map((r) => [`${r.target_id}:${r.survey_type}`, r.submitted_at])
  );

  if (myRole === "Appointer") {
    // 自己評価のみ
    const done = submittedMap.has(`${myId}:self`);
    return NextResponse.json({ role: "Appointer", fullySubmitted: done, pages: [{ targetId: myId, type: "self", submitted: done }] });
  }

  if (myRole === "AM") {
    // 管轄アポインターの評価 + 自己評価
    const { data: appointers } = await supabaseAdmin
      .from("users")
      .select("id, nickname, name")
      .eq("education_mentor_user_id", myId)
      .eq("role", "Appointer")
      .eq("setup_completed", true);

    const pages = (appointers ?? []).map((u) => ({
      targetId:  u.id,
      targetName: u.nickname ?? u.name ?? u.id,
      type: "eval",
      submitted: submittedMap.has(`${u.id}:eval`),
    }));
    // 最後に自己評価
    pages.push({ targetId: myId, targetName: "自己評価", type: "self", submitted: submittedMap.has(`${myId}:self`) });

    const fullySubmitted = pages.every((p) => p.submitted);
    return NextResponse.json({ role: "AM", fullySubmitted, pages });
  }

  if (myRole === "Sales") {
    // 同チームのAMを評価
    const teamQuery = myTeam
      ? supabaseAdmin.from("users").select("id, nickname, name").eq("role", "AM").eq("team", myTeam).eq("setup_completed", true)
      : supabaseAdmin.from("users").select("id, nickname, name").eq("role", "AM").eq("setup_completed", true);

    const { data: ams } = await teamQuery;

    const pages = (ams ?? []).map((u) => ({
      targetId:  u.id,
      targetName: u.nickname ?? u.name ?? u.id,
      type: "eval",
      submitted: submittedMap.has(`${u.id}:eval`),
    }));

    const fullySubmitted = pages.length > 0 && pages.every((p) => p.submitted);
    return NextResponse.json({ role: "Sales", fullySubmitted, pages });
  }

  return NextResponse.json({ role: myRole, fullySubmitted: true, pages: [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myId = session.user.dbId;
  const body  = await req.json();
  const { year, month, targetId, surveyType, q1Score, q1Reason, q2Score, q2Reason, q3Score, q3Reason, q4Score, q4Reason } = body;

  if (!year || !month || !targetId || !surveyType) {
    return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("survey_answers")
    .upsert(
      {
        year, month,
        respondent_id: myId,
        target_id:     targetId,
        survey_type:   surveyType,
        q1_score:  q1Score  ?? null, q1_reason: q1Reason ?? null,
        q2_score:  q2Score  ?? null, q2_reason: q2Reason ?? null,
        q3_score:  q3Score  ?? null, q3_reason: q3Reason ?? null,
        q4_score:  q4Score  ?? null, q4_reason: q4Reason ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "year,month,respondent_id,target_id,survey_type" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
