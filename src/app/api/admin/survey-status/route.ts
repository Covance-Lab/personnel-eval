/**
 * GET /api/admin/survey-status?year=&month=
 * アンケート提出状況を全ユーザー分返す（Admin専用）
 * Appointer / AM / Sales 全員対象
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

  // Appointer + AM + Sales 全員取得
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, nickname, name, role, team, education_mentor_user_id")
    .in("role", ["Appointer", "AM", "Sales"])
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

  const result = await Promise.all(
    (users ?? []).map(async (u) => {
      const done = submittedMap.get(u.id) ?? new Set<string>();

      if (u.role === "Appointer") {
        const required  = 1;
        const submittedCount = done.has(`${u.id}:self`) ? 1 : 0;
        return {
          id: u.id,
          name: u.nickname ?? u.name ?? u.id,
          role: u.role,
          team: u.team,
          required,
          submitted: submittedCount,
          fullySubmitted: submittedCount >= required,
          detail: `自己評価: ${done.has(`${u.id}:self`) ? "済" : "未"}`,
        };
      }

      if (u.role === "AM") {
        const { data: appointers } = await supabaseAdmin
          .from("users")
          .select("id, nickname, name")
          .eq("education_mentor_user_id", u.id)
          .eq("role", "Appointer")
          .eq("setup_completed", true);

        const appoCount = (appointers ?? []).length;
        const required  = appoCount + 1;
        let submittedCount = 0;
        const details: string[] = [];

        for (const a of appointers ?? []) {
          const ok = done.has(`${a.id}:eval`);
          if (ok) submittedCount++;
          details.push(`${a.nickname ?? a.name}: ${ok ? "済" : "未"}`);
        }
        const selfOk = done.has(`${u.id}:self`);
        if (selfOk) submittedCount++;
        details.push(`自己: ${selfOk ? "済" : "未"}`);

        return {
          id: u.id,
          name: u.nickname ?? u.name ?? u.id,
          role: u.role,
          team: u.team,
          required,
          submitted: submittedCount,
          fullySubmitted: submittedCount >= required,
          detail: details.join("　"),
        };
      }

      if (u.role === "Sales") {
        // 同チームのAMを取得
        const { data: ams } = await supabaseAdmin
          .from("users")
          .select("id, nickname, name")
          .eq("role", "AM")
          .eq("team", u.team)
          .eq("setup_completed", true);

        const details: string[] = [];
        let submittedCount = 0;
        let required = 0;

        for (const am of ams ?? []) {
          // このAMの管轄アポインターを評価
          const { data: appointers } = await supabaseAdmin
            .from("users")
            .select("id, nickname, name")
            .eq("education_mentor_user_id", am.id)
            .eq("role", "Appointer")
            .eq("setup_completed", true);

          for (const ap of appointers ?? []) {
            required++;
            const ok = done.has(`${ap.id}:eval`);
            if (ok) submittedCount++;
            details.push(`${ap.nickname ?? ap.name}評価: ${ok ? "済" : "未"}`);
          }
          // AMの評価
          required++;
          const amOk = done.has(`${am.id}:eval`);
          if (amOk) submittedCount++;
          details.push(`${am.nickname ?? am.name}(AM)評価: ${amOk ? "済" : "未"}`);
        }

        return {
          id: u.id,
          name: u.nickname ?? u.name ?? u.id,
          role: u.role,
          team: u.team,
          required,
          submitted: submittedCount,
          fullySubmitted: required > 0 && submittedCount >= required,
          detail: details.join("　"),
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
        detail: "",
      };
    })
  );

  const total     = result.length;
  const doneCount = result.filter((r) => r.fullySubmitted).length;

  return NextResponse.json({ users: result, total, doneCount, year, month });
}
