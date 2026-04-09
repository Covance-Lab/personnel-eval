/**
 * GET  /api/questionnaire?userId=UUID&monthKey=YYYY-MM  — 回答状況確認
 * POST /api/questionnaire                               — 回答保存
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId   = searchParams.get("userId") ?? session.user.dbId;
  const monthKey = searchParams.get("monthKey");

  if (!monthKey) {
    return NextResponse.json({ error: "monthKey は必須です" }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from("questionnaire_answers")
    .select("id, submitted_at, self_check, next_action, rating")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .single();

  return NextResponse.json({
    submitted:   Boolean(data),
    submittedAt: data?.submitted_at ?? null,
    answer:      data ? { selfCheck: data.self_check, nextAction: data.next_action, rating: data.rating } : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { monthKey, selfCheck, nextAction, rating } = await req.json();
  if (!monthKey) {
    return NextResponse.json({ error: "monthKey は必須です" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("questionnaire_answers")
    .upsert(
      {
        user_id:     session.user.dbId,
        month_key:   monthKey,
        submitted_at: new Date().toISOString(),
        self_check:  selfCheck ?? null,
        next_action: nextAction ?? null,
        rating:      rating ?? null,
      },
      { onConflict: "user_id,month_key" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, answer: data });
}
