/**
 * GET /api/evaluation?year=&month=
 * 自分の評価結果を取得（visible_to_user=trueの場合のみ返す）
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
  const myId  = session.user.dbId;

  const { data, error } = await supabaseAdmin
    .from("evaluation_results")
    .select("*")
    .eq("user_id", myId)
    .eq("year", year)
    .eq("month", month)
    .eq("visible_to_user", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ result: data ?? null });
}
