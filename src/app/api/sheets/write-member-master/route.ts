/**
 * POST /api/sheets/write-member-master
 * ログインユーザーの情報をメンバーマスタシートに書き込む（手動呼び出し用）
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeMemberMaster } from "@/lib/sheets/writeMemberMaster";

export async function POST() {
  const session = await auth();
  if (!session?.user?.dbId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await writeMemberMaster(session.user.dbId);

  if (!result.ok && !result.skipped) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
