import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.dbId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("monthly_aggregates")
    .select("year, month, b_exec_count, a_set_count, a_exec_count, contract_count, revenue")
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const aggregates = (data ?? []).map((r) => ({
    year: r.year,
    month: r.month,
    bExecCount:    r.b_exec_count ?? 0,
    aSetCount:     r.a_set_count ?? 0,
    aExecCount:    r.a_exec_count ?? 0,
    contractCount: r.contract_count ?? 0,
    revenue:       r.revenue ?? 0,
  }));

  return NextResponse.json({ aggregates });
}
