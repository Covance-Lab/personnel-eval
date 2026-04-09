/**
 * GET /api/sheets/config
 *
 * サーバー側の環境変数から、Google Sheets API が設定済みかどうかを返す。
 * 認証情報自体は返さない（セキュリティ上）。
 */

import { NextResponse } from "next/server";

export async function GET() {
  const hasCredentials = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  return NextResponse.json({
    hasCredentials,
    mockMode: !hasCredentials,
  });
}
