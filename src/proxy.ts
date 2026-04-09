/**
 * Next.js Middleware: セッションチェック＋ルートガード
 * next-auth v5 の NextAuthRequest 型を使用
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  // パブリックパスはスルー
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // static files はスルー
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|svg|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const session = req.auth;

  // API routes は各ルートハンドラで認証チェックするためリダイレクトしない
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 未認証 → ログインページへ
  if (!session?.user?.dbId) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // セットアップ未完了 → /setup へ（/setup 以外）
  if (!session.user.setupCompleted && !pathname.startsWith("/setup")) {
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  // /admin は Admin ロールのみ
  if (pathname.startsWith("/admin") && session.user.role !== "Admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
