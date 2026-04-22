/**
 * GET /api/stats?year=2026&month=4
 * 全体・チーム別の集計統計を返す（Admin専用）
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface TeamStats {
  team: string;
  appointerCount: number;
  dmCount: number;
  bSetCount: number;   // B設定数 = appo_count
  bSetRate: number;    // B設定率 = appo_count / dm_count * 100
}

interface MonthStats {
  year: number;
  month: number;
  overall: TeamStats;
  byTeam: TeamStats[];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["Admin", "AM", "AM_Sales", "Sales"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));

  // 前月の年月
  const prevDate = new Date(year, month - 2, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  // 今月・前月の実績を取得
  const [currRes, prevRes, usersRes] = await Promise.all([
    supabaseAdmin
      .from("performance_records")
      .select("user_id, team, dm_count, appo_count")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("performance_records")
      .select("user_id, team, dm_count, appo_count")
      .eq("year", prevYear)
      .eq("month", prevMonth),
    supabaseAdmin
      .from("users")
      .select("id, team, role")
      .eq("role", "Appointer")
      .eq("setup_completed", true),
  ]);

  const currRecords = currRes.data ?? [];
  const prevRecords = prevRes.data ?? [];
  const allUsers    = usersRes.data ?? [];

  const TEAMS = ["辻利", "LUMIA", "Covance"];

  function calcStats(
    records: typeof currRecords,
    users: typeof allUsers,
    teamFilter?: string
  ): TeamStats {
    const filteredRecords = teamFilter
      ? records.filter((r) => r.team === teamFilter)
      : records;
    const filteredUsers = teamFilter
      ? users.filter((u) => u.team === teamFilter)
      : users;

    const dmCount  = filteredRecords.reduce((s, r) => s + (r.dm_count ?? 0), 0);
    const bSetCount = filteredRecords.reduce((s, r) => s + (r.appo_count ?? 0), 0);
    const bSetRate  = dmCount > 0 ? Math.round((bSetCount / dmCount) * 1000) / 10 : 0;

    return {
      team: teamFilter ?? "全体",
      appointerCount: filteredUsers.length,
      dmCount,
      bSetCount,
      bSetRate,
    };
  }

  function buildMonthStats(
    records: typeof currRecords,
    users: typeof allUsers,
    y: number,
    m: number
  ): MonthStats {
    return {
      year: y,
      month: m,
      overall: calcStats(records, users),
      byTeam: TEAMS.map((t) => calcStats(records, users, t)),
    };
  }

  const current  = buildMonthStats(currRecords, allUsers, year, month);
  const previous = buildMonthStats(prevRecords, allUsers, prevYear, prevMonth);

  // 月次トレンド（直近12ヶ月）
  const trendMonths: { year: number; month: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    trendMonths.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const trendOr = trendMonths.map((m) => `and(year.eq.${m.year},month.eq.${m.month})`).join(",");

  const [trendRes, aggregatesRes, teamAggCurrRes, teamAggPrevRes, teamAggTrendRes] = await Promise.all([
    supabaseAdmin
      .from("performance_records")
      .select("user_id, team, dm_count, appo_count, year, month")
      .or(trendOr),
    supabaseAdmin
      .from("monthly_aggregates")
      .select("year, month, b_exec_count, a_set_count, a_exec_count, contract_count, revenue")
      .or(trendOr),
    supabaseAdmin
      .from("team_monthly_aggregates")
      .select("team, dm_count, b_set_count, b_exec_count, a_set_count, a_exec_count, contract_count")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("team_monthly_aggregates")
      .select("team, dm_count, b_set_count, b_exec_count, a_set_count, a_exec_count, contract_count")
      .eq("year", prevYear)
      .eq("month", prevMonth),
    supabaseAdmin
      .from("team_monthly_aggregates")
      .select("year, month, team, dm_count, b_set_count, b_exec_count, a_set_count, a_exec_count, contract_count")
      .or(trendOr),
  ]);

  const trendRecords = trendRes.data ?? [];
  const aggregateMap = new Map(
    (aggregatesRes.data ?? []).map((a) => [`${a.year}-${a.month}`, a])
  );

  // 今月・前月の集計データ
  const currAggregate = aggregateMap.get(`${year}-${month}`) ?? null;
  const prevAggregate = aggregateMap.get(`${prevYear}-${prevMonth}`) ?? null;

  // チーム別集計トレンドマップ: "year-month" → team → counts
  const teamAggTrendRows = teamAggTrendRes.data ?? [];
  const teamAggByMonth = new Map<string, Record<string, {
    dmCount?: number; bSetCount: number; bExecCount: number; aSetCount: number; aExecCount: number; contractCount: number;
  }>>();
  for (const r of teamAggTrendRows) {
    const key = `${r.year}-${r.month}`;
    if (!teamAggByMonth.has(key)) teamAggByMonth.set(key, {});
    teamAggByMonth.get(key)![r.team] = {
      dmCount:       r.dm_count      != null ? r.dm_count : undefined,
      bSetCount:     r.b_set_count    ?? 0,
      bExecCount:    r.b_exec_count   ?? 0,
      aSetCount:     r.a_set_count    ?? 0,
      aExecCount:    r.a_exec_count   ?? 0,
      contractCount: r.contract_count ?? 0,
    };
  }

  const trend = trendMonths.map(({ year: y, month: m }) => {
    const recs = trendRecords.filter((r) => r.year === y && r.month === m);
    const agg  = aggregateMap.get(`${y}-${m}`) ?? null;
    return {
      year: y,
      month: m,
      label: `${y}/${String(m).padStart(2, "0")}`,
      overall: calcStats(recs, allUsers),
      byTeam: TEAMS.map((t) => calcStats(recs, allUsers, t)),
      aggregate: agg
        ? {
            bExecCount:    agg.b_exec_count ?? 0,
            aSetCount:     agg.a_set_count ?? 0,
            aExecCount:    agg.a_exec_count ?? 0,
            contractCount: agg.contract_count ?? 0,
            revenue:       agg.revenue ?? 0,
          }
        : null,
      teamAggregates: teamAggByMonth.get(`${y}-${m}`) ?? {},
    };
  });

  // チーム別集計データをマップ化
  function toTeamAggMap(rows: typeof teamAggCurrRes.data) {
    const map = new Map<string, {
      dmCount?: number; bSetCount: number; bExecCount: number;
      aSetCount: number; aExecCount: number; contractCount: number;
    }>();
    for (const r of rows ?? []) {
      map.set(r.team, {
        dmCount:       r.dm_count      != null ? r.dm_count : undefined,
        bSetCount:     r.b_set_count    ?? 0,
        bExecCount:    r.b_exec_count   ?? 0,
        aSetCount:     r.a_set_count    ?? 0,
        aExecCount:    r.a_exec_count   ?? 0,
        contractCount: r.contract_count ?? 0,
      });
    }
    return map;
  }
  const currTeamAggMap = toTeamAggMap(teamAggCurrRes.data);
  const prevTeamAggMap = toTeamAggMap(teamAggPrevRes.data);

  return NextResponse.json({
    current,
    previous,
    trend,
    currentAggregate: currAggregate
      ? {
          bExecCount:    currAggregate.b_exec_count ?? 0,
          aSetCount:     currAggregate.a_set_count ?? 0,
          aExecCount:    currAggregate.a_exec_count ?? 0,
          contractCount: currAggregate.contract_count ?? 0,
          revenue:       currAggregate.revenue ?? 0,
        }
      : null,
    previousAggregate: prevAggregate
      ? {
          bExecCount:    prevAggregate.b_exec_count ?? 0,
          aSetCount:     prevAggregate.a_set_count ?? 0,
          aExecCount:    prevAggregate.a_exec_count ?? 0,
          contractCount: prevAggregate.contract_count ?? 0,
          revenue:       prevAggregate.revenue ?? 0,
        }
      : null,
    currentTeamAggregates:  Object.fromEntries(currTeamAggMap),
    previousTeamAggregates: Object.fromEntries(prevTeamAggMap),
  });
}
