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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-gray-900">{title}</h1>
          <NavMenu role={role} userName={userName} userImage={userImage} userTeam={userTeam} />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
