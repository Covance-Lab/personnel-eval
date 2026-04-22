/**
 * GET /api/am-sales/stats
 * AM_Sales兼任者用: チーム全体・自分管轄・他AM管轄の数値を返す
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["Admin", "AM_Sales"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const myId   = session.user.dbId;
  const myTeam = session.user.team;

  if (!myTeam) {
    return NextResponse.json({ error: "チームが未設定です" }, { status: 400 });
  }

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const prevDate  = new Date(thisYear, thisMonth - 2, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  // ── ① 自分管轄のアポインター
  const { data: ownAppointerRows } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("role", "Appointer")
    .eq("education_mentor_user_id", myId)
    .eq("setup_completed", true);
  const ownAppointerIds = (ownAppointerRows ?? []).map((u) => u.id);

  // ── ② 自チームの他AM（AM / AM_Sales）
  const { data: otherAMRows } = await supabaseAdmin
    .from("users")
    .select("id")
    .in("role", ["AM", "AM_Sales"])
    .eq("team", myTeam)
    .eq("setup_completed", true)
    .neq("id", myId);
  const otherAMIds = (otherAMRows ?? []).map((u) => u.id);

  // ── ③ 他AMが管理するアポインター
  const { data: otherAppointerRows } = otherAMIds.length > 0
    ? await supabaseAdmin
        .from("users")
        .select("id")
        .eq("role", "Appointer")
        .in("education_mentor_user_id", otherAMIds)
        .eq("setup_completed", true)
    : { data: [] };
  const otherAppointerIds = (otherAppointerRows ?? []).map((u) => u.id);

  const allAppointerIds = [...ownAppointerIds, ...otherAppointerIds];

  // ── ④ パフォーマンスレコード
  const [currTeam, prevTeam, currOwn, prevOwn, currOther, prevOther] = await Promise.all([
    supabaseAdmin.from("performance_records")
      .select("user_id, dm_count, appo_count, b_executed_count, a_set_count, a_executed_count, contract_count")
      .eq("year", thisYear).eq("month", thisMonth).eq("team", myTeam),
    supabaseAdmin.from("performance_records")
      .select("user_id, dm_count, appo_count, b_executed_count, a_set_count, a_executed_count, contract_count")
      .eq("year", prevYear).eq("month", prevMonth).eq("team", myTeam),
    ownAppointerIds.length > 0
      ? supabaseAdmin.from("performance_records")
          .select("user_id, dm_count, appo_count, b_executed_count, a_set_count, a_executed_count, contract_count")
          .eq("year", thisYear).eq("month", thisMonth).in("user_id", ownAppointerIds)
      : Promise.resolve({ data: [] }),
    ownAppointerIds.length > 0
      ? supabaseAdmin.from("performance_records")
          .select("user_id, dm_count, appo_count, b_executed_count, a_set_count, a_executed_count, contract_count")
          .eq("year", prevYear).eq("month", prevMonth).in("user_id", ownAppointerIds)
      : Promise.resolve({ data: [] }),
    otherAppointerIds.length > 0
      ? supabaseAdmin.from("performance_records")
          .select("user_id, dm_count, appo_count, b_executed_count, a_set_count, a_executed_count, contract_count")
          .eq("year", thisYear).eq("month", thisMonth).in("user_id", otherAppointerIds)
      : Promise.resolve({ data: [] }),
    otherAppointerIds.length > 0
      ? supabaseAdmin.from("performance_records")
          .select("user_id, dm_count, appo_count, b_executed_count, a_set_count, a_executed_count, contract_count")
          .eq("year", prevYear).eq("month", prevMonth).in("user_id", otherAppointerIds)
      : Promise.resolve({ data: [] }),
  ]);

  // ── ⑤ チームファネル集計（team_monthly_aggregates）
  const [currAgg, prevAgg] = await Promise.all([
    supabaseAdmin.from("team_monthly_aggregates")
      .select("dm_count, b_set_count, b_exec_count, a_set_count, a_exec_count, contract_count, revenue")
      .eq("team", myTeam).eq("year", thisYear).eq("month", thisMonth).maybeSingle(),
    supabaseAdmin.from("team_monthly_aggregates")
      .select("dm_count, b_set_count, b_exec_count, a_set_count, a_exec_count, contract_count, revenue")
      .eq("team", myTeam).eq("year", prevYear).eq("month", prevMonth).maybeSingle(),
  ]);

  // ── ヘルパー
  type PerfRow = { user_id: string; dm_count: number | null; appo_count: number | null; b_executed_count?: number | null; a_set_count?: number | null; a_executed_count?: number | null; contract_count?: number | null };

  function sumSection(rows: PerfRow[], count: number) {
    const dm    = rows.reduce((s, r) => s + (r.dm_count ?? 0), 0);
    const bSet  = rows.reduce((s, r) => s + (r.appo_count ?? 0), 0);
    const bExec = rows.reduce((s, r) => s + (r.b_executed_count ?? 0), 0);
    const aSet  = rows.reduce((s, r) => s + (r.a_set_count ?? 0), 0);
    const aExec = rows.reduce((s, r) => s + (r.a_executed_count ?? 0), 0);
    const cont  = rows.reduce((s, r) => s + (r.contract_count ?? 0), 0);
    return {
      appointerCount: count,
      dmCount:      dm,
      bSetCount:    bSet,
      bSetRate:     pct(bSet, dm),
      bExecCount:   bExec,
      bExecRate:    pct(bExec, bSet),
      aSetCount:    aSet,
      aSetRate:     pct(aSet, bExec),
      aExecCount:   aExec,
      aExecRate:    pct(aExec, aSet),
      contractCount: cont,
      contractRate: pct(cont, aExec),
    };
  }

  function buildTeamSection(agg: typeof currAgg["data"] | null) {
    const dm    = agg?.dm_count    ?? 0;
    const bSet  = agg?.b_set_count ?? 0;
    const bExec = agg?.b_exec_count ?? 0;
    const aSet  = agg?.a_set_count  ?? 0;
    const aExec = agg?.a_exec_count ?? 0;
    const cont  = agg?.contract_count ?? 0;
    return {
      appointerCount: allAppointerIds.length,
      dmCount:      dm,
      bSetCount:    bSet,
      bSetRate:     pct(bSet, dm),
      bExecCount:   bExec,
      bExecRate:    pct(bExec, bSet),
      aSetCount:    aSet,
      aSetRate:     pct(aSet, bExec),
      aExecCount:   aExec,
      aExecRate:    pct(aExec, aSet),
      contractCount: cont,
      contractRate: pct(cont, aExec),
      revenue:      agg?.revenue ?? 0,
    };
  }

  const currTeamRows  = (currTeam.data  ?? []) as PerfRow[];
  const prevTeamRows  = (prevTeam.data  ?? []) as PerfRow[];
  const currOwnRows   = (currOwn.data   ?? []) as PerfRow[];
  const prevOwnRows   = (prevOwn.data   ?? []) as PerfRow[];
  const currOtherRows = (currOther.data ?? []) as PerfRow[];
  const prevOtherRows = (prevOther.data ?? []) as PerfRow[];

  return NextResponse.json({
    curr: {
      teamTotal:     buildTeamSection(currAgg.data),
      ownAppointers: sumSection(currOwnRows,   ownAppointerIds.length),
      otherAMs:      sumSection(currOtherRows, otherAppointerIds.length),
    },
    prev: {
      teamTotal:     buildTeamSection(prevAgg.data),
      ownAppointers: sumSection(prevOwnRows,   ownAppointerIds.length),
      otherAMs:      sumSection(prevOtherRows, otherAppointerIds.length),
    },
    otherAMCount: otherAMIds.length,
    team: myTeam,
    // チームレコード（参照用）
    _unused: currTeamRows.length,
  });
}
