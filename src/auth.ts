/**
 * NextAuth v5 設定 (LINE OAuth + Supabase ユーザー管理)
 */

import NextAuth from "next-auth";
import LINE from "next-auth/providers/line";
import type { Role } from "@/types/user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    LINE({
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    /**
     * サインイン時: Supabase に users レコードを upsert する
     * ここではサーバーサイドの import が必要なため dynamic import を使用
     */
    async signIn({ account, profile }) {
      if (account?.provider !== "line") return false;

      try {
        const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
        const lineId = account.providerAccountId;

        // ADMIN_LINE_IDS 環境変数でAdminを事前割り当て
        const adminLineIds = (process.env.ADMIN_LINE_IDS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const isPresetAdmin = adminLineIds.includes(lineId);

        // upsert: line_id が同じレコードがあれば LINE名と画像だけ更新
        const { error } = await supabaseAdmin.from("users").upsert(
          {
            line_id: lineId,
            line_name: profile?.name ?? null,
            line_picture_url:
              (profile as { picture?: string })?.picture ??
              (profile as { pictureUrl?: string })?.pictureUrl ??
              null,
            // 初回のみ role を設定（既存レコードは変更しない）
            ...(isPresetAdmin ? { role: "Admin" as Role } : {}),
          },
          {
            onConflict: "line_id",
            // 既存レコードの role / team / setup_completed は上書きしない
            ignoreDuplicates: false,
          }
        );

        if (error) {
          console.error("[Auth] Supabase upsert error:", error);
          return false;
        }
        return true;
      } catch (err) {
        console.error("[Auth] signIn error:", err);
        return false;
      }
    },

    /**
     * JWT 生成時: lineId をトークンに保存
     */
    async jwt({ token, account }) {
      if (account?.provider === "line") {
        token.lineId = account.providerAccountId;
      }
      return token;
    },

    /**
     * セッション生成時: Supabase からユーザー情報を取得してセッションに付加
     */
    async session({ session, token }) {
      if (token.lineId) {
        try {
          const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("id, role, setup_completed, team, nickname")
            .eq("line_id", token.lineId)
            .single();

          if (user) {
            session.user.dbId           = user.id as string;
            session.user.lineId         = (token.lineId ?? "") as string;
            session.user.role           = user.role as Role;
            session.user.setupCompleted = user.setup_completed as boolean;
            session.user.team           = (user.team ?? undefined) as typeof session.user.team;
            session.user.nickname       = (user.nickname ?? undefined) as string | undefined;
          }
        } catch (err) {
          console.error("[Auth] session callback error:", err);
        }
      }
      return session;
    },
  },
});
