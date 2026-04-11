/**
 * GET /api/admin/survey-status?year=&month=
 * アンケート提出状況を全ユーザー分返す（Admin専用）
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

  // Appointer + AM 全員取得
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, nickname, name, role, team, education_mentor_user_id")
    .in("role", ["Appointer", "AM"])
    .eq("setup_completed", true)
    .order("role")
    .order("team");

  if (!users || users.length === 0) {
    return NextResponse.json({ users: [], year, month });
  }

  // 当月の提出済みアンケート取得
  const { data: submitted } = await supabaseAdmin
    .from("survey_answers")
    .select("respondent_id, target_id, survey_type")
    .eq("year", year)
    .eq("month", month);

  // respondent_id → 提出済み (target_id:type) セット
  const submittedMap = new Map<string, Set<string>>();
  for (const s of submitted ?? []) {
    if (!submittedMap.has(s.respondent_id)) submittedMap.set(s.respondent_id, new Set());
    submittedMap.get(s.respondent_id)!.add(`${s.target_id}:${s.survey_type}`);
  }

  // 各ユーザーの「必要ページ数」と「提出済みページ数」を計算
  const result = await Promise.all(
    (users ?? []).map(async (u) => {
      const done = submittedMap.get(u.id) ?? new Set<string>();

      if (u.role === "Appointer") {
        const required = 1; // 自己評価のみ
        const submitted = done.has(`${u.id}:self`) ? 1 : 0;
        return {
          id: u.id,
          name: u.nickname ?? u.name ?? u.id,
          role: u.role,
          team: u.team,
          required,
          submitted,
          fullySubmitted: submitted >= required,
        };
      }

      if (u.role === "AM") {
        // 管轄アポインター数 + 自己評価
        const { data: appointers } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("education_mentor_user_id", u.id)
          .eq("role", "Appointer")
          .eq("setup_completed", true);

        const appoCount = (appointers ?? []).length;
        const required = appoCount + 1;
        let submittedCount = 0;
        for (const a of appointers ?? []) {
          if (done.has(`${a.id}:eval`)) submittedCount++;
        }
        if (done.has(`${u.id}:self`)) submittedCount++;

        return {
          id: u.id,
          name: u.nickname ?? u.name ?? u.id,
          role: u.role,
          team: u.team,
          required,
          submitted: submittedCount,
          fullySubmitted: submittedCount >= required,
        };
      }

      return {
        id: u.id,
        name: u.nickname ?? u.name ?? u.id,
        role: u.role,
        team: u.team,
        required: 0,
        submitted: 0,
        fullySubmitted: true,
      };
    })
  );

  const total      = result.length;
  const doneCount  = result.filter((r) => r.fullySubmitted).length;

  return NextResponse.json({ users: result, total, doneCount, year, month });
}
