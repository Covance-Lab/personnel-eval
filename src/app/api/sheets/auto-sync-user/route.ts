/**
 * POST /api/sheets/auto-sync-user
 *
 * ログインユーザーの実績データをスプレッドシートから自動検索して返す。
 * A列=チーム名、B列=あだ名 で一致する行を「全チーム統合シート」の直近月タブから取得。
 * 見つからない場合（デビュー前）は 0 を返す。
 *
 * Body: { year?: number; month?: number }
 *   省略時は現在の年月を使用。見つからなければ前月を試みる。
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchSheetRange } from "@/lib/sheets/sheetsClient";

function normalizeName(s: string): string {
  return s.normalize("NFKC").replace(/[\r\n\s　]/g, "").toLowerCase();
}

function parseNum(v: string | number | undefined): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.dbId;
  const body = await req.json().catch(() => ({}));

  const now   = new Date();
  const year  = Number(body.year  ?? now.getFullYear());
  const month = Number(body.month ?? now.getMonth() + 1);

  // ユーザーのチームとあだ名を取得
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("team, nickname, name")
    .eq("id", userId)
    .single();

  const userTeam     = (user?.team as string | null) ?? "";
  const userNickname = (user?.nickname as string | null) ?? "";
  const userName     = (user?.name as string | null) ?? "";

  if (!userTeam || (!userNickname && !userName)) {
    // プロフィール未設定 → 0で返す
    return NextResponse.json({ ok: true, found: false, dmCount: 0, appoCount: 0, income: 0 });
  }

  // sheet_configs の "全チーム" 設定を取得
  const { data: cfg } = await supabaseAdmin
    .from("sheet_configs")
    .select("spreadsheet_id, team_column, name_column, dm_count_column, appo_count_column, income_column, data_start_row")
    .eq("team", "全チーム")
    .single();

  if (!cfg?.spreadsheet_id) {
    return NextResponse.json({ ok: true, found: false, dmCount: 0, appoCount: 0, income: 0, reason: "スプレッドシート未設定" });
  }

  const spreadsheetId = cfg.spreadsheet_id as string;
  const teamIdx  = colIdx((cfg.team_column  as string | null) ?? "A");
  const nameIdx  = colIdx((cfg.name_column  as string | null) ?? "B");
  const dmIdx    = colIdx((cfg.dm_count_column as string | null) ?? "C");
  const appoIdx  = colIdx((cfg.appo_count_column as string | null) ?? "E");
  const incomeIdx = colIdx((cfg.income_column as string | null) ?? "F");
  const startRow  = ((cfg.data_start_row as number | null) ?? 2) - 1; // 0-indexed

  const maxIdx = Math.max(teamIdx, nameIdx, dmIdx, appoIdx, incomeIdx);
  const endCol = String.fromCharCode(65 + maxIdx);
  const range  = `A${startRow + 1}:${endCol}2000`;

  // 当月→前月の順で試みる
  const monthsToTry = [{ year, month }];
  if (month === 1) {
    monthsToTry.push({ year: year - 1, month: 12 });
  } else {
    monthsToTry.push({ year, month: month - 1 });
  }

  const normalizedNickname = normalizeName(userNickname);
  const normalizedName     = normalizeName(userName);
  const normalizedTeam     = normalizeName(userTeam);

  for (const { year: y, month: m } of monthsToTry) {
    const sheetName = `${m}月`;
    let rows: (string | number)[][];
    let isMock = false;

    try {
      const result = await fetchSheetRange({ spreadsheetId, sheetName, range });
      rows  = result.rows;
      isMock = result.isMock;
    } catch {
      continue; // タブがなければ次の月を試みる
    }

    for (const row of rows) {
      const rowTeam = normalizeName(String(row[teamIdx] ?? ""));
      const rowName = normalizeName(String(row[nameIdx] ?? ""));
      if (!rowName) continue;

      const teamMatch = !normalizedTeam || rowTeam === normalizedTeam;
      const nameMatch = rowName === normalizedNickname || rowName === normalizedName;

      if (!teamMatch || !nameMatch) continue;

      // 一致した行のデータを取得
      const dmCount   = parseNum(row[dmIdx]);
      const appoCount = parseNum(row[appoIdx]);
      const income    = parseNum(row[incomeIdx]);
      const syncedAt  = new Date().toISOString();

      // performance_records に upsert
      await supabaseAdmin
        .from("performance_records")
        .upsert({
          user_id:          userId,
          sheet_name:       String(row[nameIdx] ?? ""),
          year:             y,
          month:            m,
          dm_count:         dmCount,
          appo_count:       appoCount,
          appointment_rate: dmCount > 0 ? Math.round((appoCount / dmCount) * 1000) / 10 : 0,
          income:           income,
          team:             userTeam,
          synced_at:        syncedAt,
        }, { onConflict: "user_id,year,month" });

      return NextResponse.json({
        ok: true,
        found: true,
        isMock,
        year: y,
        month: m,
        dmCount,
        appoCount,
        income,
      });
    }
  }

  // どの月のタブにも見つからなかった → 0で返す
  return NextResponse.json({ ok: true, found: false, dmCount: 0, appoCount: 0, income: 0 });
}

function colIdx(letter: string): number {
  const upper = letter.toUpperCase();
  let idx = 0;
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64);
  }
  return idx - 1;
}
