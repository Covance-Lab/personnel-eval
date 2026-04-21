"use client";

import NavMenu from "./NavMenu";
import type { Role } from "@/types/user";

interface PageLayoutProps {
  title: string;
  role: Role;
  userName: string;
  userImage?: string | null;
  userTeam?: string;
  children: React.ReactNode;
}

export default function PageLayout({ title, role, userName, userImage, userTeam, children }: PageLayoutProps) {
  return (
    <div className="min-h-screen" style={{ background: "#fff9ec" }}>
      {/* ゴールドアクセントバー */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #cfa340 0%, #e8c060 50%, #cfa340 100%)" }} />

      <header className="border-b border-amber-100 sticky top-0 z-30 shadow-sm" style={{ background: "#fffdf7" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* ゴールドドット */}
            <div className="w-2 h-2 rounded-full" style={{ background: "#cfa340" }} />
            <h1 className="font-bold text-gray-900 tracking-tight">{title}</h1>
          </div>
          <NavMenu role={role} userName={userName} userImage={userImage} userTeam={userTeam} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
