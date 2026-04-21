/**
 * GET /api/am-sales/stats
 * AM_Sales兼任者用: 3セクションの数値を返す
 *   1. teamTotal    — チーム全体の合計
 *   2. ownAppointers — 自分管轄のアポインター合計
 *   3. otherAMs      — 自チームの他AMが管理するアポインター合計
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface PerfSection {
  appointerCount: number;
  dmCount: number;
  bSetCount: number;
  bSetRate: number;
}

interface FunnelSection {
  bExecCount: number;
  aSetCount: number;
  aExecCount: number;
  contractCount: number;
  bExecRate: number;
  aSetRate: number;
  aExecRate: number;
  contractRate: number;
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

  // ── ④ パフォーマンスレコード取得（チーム全体 + 今月 / 前月）
  const allAppointerIds = [...ownAppointerIds, ...otherAppointerIds];

  const [currTeam, prevTeam, currAll, prevAll] = await Promise.all([
    supabaseAdmin
      .from("performance_records")
      .select("user_id, dm_count, appo_count")
      .eq("year", thisYear)
      .eq("month", thisMonth)
      .eq("team", myTeam),
    supabaseAdmin
      .from("performance_records")
      .select("user_id, dm_count, appo_count")
      .eq("year", prevYear)
      .eq("month", prevMonth)
      .eq("team", myTeam),
    allAppointerIds.length > 0
      ? supabaseAdmin
          .from("performance_records")
          .select("user_id, dm_count, appo_count")
          .eq("year", thisYear)
          .eq("month", thisMonth)
          .in("user_id", allAppointerIds)
      : Promise.resolve({ data: [] }),
    allAppointerIds.length > 0
      ? supabaseAdmin
          .from("performance_records")
          .select("user_id, dm_count, appo_count")
          .eq("year", prevYear)
          .eq("month", prevMonth)
          .in("user_id", allAppointerIds)
      : Promise.resolve({ data: [] }),
  ]);

  // ── ⑤ チームファネル（team_monthly_aggregates）
  const [currAgg, prevAgg] = await Promise.all([
    supabaseAdmin
      .from("team_monthly_aggregates")
      .select("dm_count, b_set_count, b_exec_count, a_set_count, a_exec_count, contract_count")
      .eq("team", myTeam)
      .eq("year", thisYear)
      .eq("month", thisMonth)
      .maybeSingle(),
    supabaseAdmin
      .from("team_monthly_aggregates")
      .select("dm_count, b_set_count, b_exec_count, a_set_count, a_exec_count, contract_count")
      .eq("team", myTeam)
      .eq("year", prevYear)
      .eq("month", prevMonth)
      .maybeSingle(),
  ]);

  // ── ヘルパー
  function sumPerf(
    records: { user_id: string; dm_count: number | null; appo_count: number | null }[],
    ids: string[] | null,
    count: number
  ): PerfSection {
    const rows = ids ? records.filter((r) => ids.includes(r.user_id)) : records;
    const dm  = rows.reduce((s, r) => s + (r.dm_count ?? 0), 0);
    const bs  = rows.reduce((s, r) => s + (r.appo_count ?? 0), 0);
    return {
      appointerCount: count,
      dmCount:   dm,
      bSetCount: bs,
      bSetRate:  dm > 0 ? Math.round((bs / dm) * 1000) / 10 : 0,
    };
  }

  function calcFunnel(agg: typeof currAgg["data"] | null): FunnelSection {
    const bSet  = agg?.b_set_count  ?? 0;
    const bExec = agg?.b_exec_count ?? 0;
    const aSet  = agg?.a_set_count  ?? 0;
    const aExec = agg?.a_exec_count ?? 0;
    const cont  = agg?.contract_count ?? 0;
    return {
      bExecCount:   bExec,
      aSetCount:    aSet,
      aExecCount:   aExec,
      contractCount: cont,
      bExecRate:    bSet  > 0 ? Math.round(bExec / bSet  * 1000) / 10 : 0,
      aSetRate:     bExec > 0 ? Math.round(aSet  / bExec * 1000) / 10 : 0,
      aExecRate:    aSet  > 0 ? Math.round(aExec / aSet  * 1000) / 10 : 0,
      contractRate: aExec > 0 ? Math.round(cont  / aExec * 1000) / 10 : 0,
    };
  }

  const currRecords = (currAll.data ?? []) as { user_id: string; dm_count: number | null; appo_count: number | null }[];
  const prevRecords = (prevAll.data ?? []) as { user_id: string; dm_count: number | null; appo_count: number | null }[];
  const currTeamRecords = (currTeam.data ?? []) as { user_id: string; dm_count: number | null; appo_count: number | null }[];
  const prevTeamRecords = (prevTeam.data ?? []) as { user_id: string; dm_count: number | null; appo_count: number | null }[];

  return NextResponse.json({
    // チーム全体（ファネル含む）
    curr: {
      teamTotal: sumPerf(currTeamRecords, null, ownAppointerIds.length + otherAppointerIds.length),
      ownAppointers: sumPerf(currRecords, ownAppointerIds, ownAppointerIds.length),
      otherAMs: sumPerf(currRecords, otherAppointerIds, otherAppointerIds.length),
      funnel: calcFunnel(currAgg.data),
    },
    prev: {
      teamTotal: sumPerf(prevTeamRecords, null, ownAppointerIds.length + otherAppointerIds.length),
      ownAppointers: sumPerf(prevRecords, ownAppointerIds, ownAppointerIds.length),
      otherAMs: sumPerf(prevRecords, otherAppointerIds, otherAppointerIds.length),
      funnel: calcFunnel(prevAgg.data),
    },
    otherAMCount: otherAMIds.length,
    team: myTeam,
  });
}
