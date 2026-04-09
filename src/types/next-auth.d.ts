import type { DefaultSession } from "next-auth";
import type { Role, TeamGroup } from "@/types/user";

declare module "next-auth" {
  interface Session {
    user: {
      /** Supabase の users.id (UUID) */
      dbId: string;
      /** LINEのproviderAccountId */
      lineId: string;
      role: Role;
      setupCompleted: boolean;
      team?: TeamGroup;
      nickname?: string;
    } & DefaultSession["user"];
  }

  interface User {
    dbId?: string;
    lineId?: string;
    role?: Role;
    setupCompleted?: boolean;
    team?: TeamGroup;
    nickname?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    lineId?: string;
    dbId?: string;
    role?: Role;
    setupCompleted?: boolean;
    team?: TeamGroup;
    nickname?: string;
  }
}
