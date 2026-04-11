/**
 * NextAuth v5 設定 (LINE OAuth + テスト用 Credentials)
 */

import NextAuth from "next-auth";
import LINE from "next-auth/providers/line";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/types/user";

// テストモード時のみ Credentials プロバイダーを追加
const testProvider =
  process.env.TEST_MODE === "true"
    ? [
        Credentials({
          credentials: {
            userId: { label: "ユーザーID", type: "text" },
          },
          async authorize(credentials) {
            if (!credentials?.userId) return null;
            const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
            const { data: user } = await supabaseAdmin
              .from("users")
              .select("id, nickname, name, line_name")
              .eq("id", credentials.userId as string)
              .single();
            if (!user) return null;
            return {
              id: user.id as string,
              name:
                (user.nickname as string | null) ??
                (user.name as string | null) ??
                (user.line_name as string | null) ??
                (user.id as string),
            };
          },
        }),
      ]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    LINE({
      clientId:     process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
    }),
    ...testProvider,
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    /**
     * サインイン時: LINEの場合のみ Supabase に upsert
     */
    async signIn({ account, profile }) {
      if (account?.provider === "credentials") return true; // テストユーザーはスキップ
      if (account?.provider !== "line") return false;

      try {
        const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
        const lineId = account.providerAccountId;

        const adminLineIds = (process.env.ADMIN_LINE_IDS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const isPresetAdmin = adminLineIds.includes(lineId);

        const { error } = await supabaseAdmin.from("users").upsert(
          {
            line_id: lineId,
            line_name: profile?.name ?? null,
            line_picture_url:
              (profile as { picture?: string })?.picture ??
              (profile as { pictureUrl?: string })?.pictureUrl ??
              null,
            ...(isPresetAdmin ? { role: "Admin" as Role } : {}),
          },
          { onConflict: "line_id", ignoreDuplicates: false }
        );

        if (error) { console.error("[Auth] Supabase upsert error:", error); return false; }
        return true;
      } catch (err) {
        console.error("[Auth] signIn error:", err);
        return false;
      }
    },

    /**
     * JWT: LINE プロバイダーのときだけ lineId を保存
     * Credentials のときは token.sub に dbId が入る（NextAuth が自動設定）
     */
    async jwt({ token, account }) {
      if (account?.provider === "line") {
        token.lineId = account.providerAccountId;
      }
      return token;
    },

    /**
     * セッション: LINE か Credentials かで分岐してユーザー情報を取得
     */
    async session({ session, token }) {
      const lineId   = token.lineId as string | undefined;
      const credDbId = !lineId ? (token.sub as string | undefined) : undefined;

      try {
        const { supabaseAdmin } = await import("@/lib/supabaseAdmin");

        if (lineId) {
          // LINE ログインユーザー
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("id, role, setup_completed, team, nickname")
            .eq("line_id", lineId)
            .single();

          if (user) {
            session.user.dbId           = user.id as string;
            session.user.lineId         = lineId;
            session.user.role           = user.role as Role;
            session.user.setupCompleted = user.setup_completed as boolean;
            session.user.team           = (user.team ?? undefined) as typeof session.user.team;
            session.user.nickname       = (user.nickname ?? undefined) as string | undefined;
          }
        } else if (credDbId) {
          // テストログインユーザー（Credentials）
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("id, role, setup_completed, team, nickname, name, line_name")
            .eq("id", credDbId)
            .single();

          if (user) {
            session.user.dbId           = user.id as string;
            session.user.lineId         = "";
            session.user.role           = user.role as Role;
            session.user.setupCompleted = user.setup_completed as boolean;
            session.user.team           = (user.team ?? undefined) as typeof session.user.team;
            session.user.nickname       =
              ((user.nickname ?? user.name ?? user.line_name) ?? undefined) as string | undefined;
          }
        }
      } catch (err) {
        console.error("[Auth] session callback error:", err);
      }

      return session;
    },
  },
});
