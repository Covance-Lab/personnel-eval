"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const ROLE_TOP: Record<string, string> = {
  Admin:     "/overview",
  Sales:     "/sales",
  AM:        "/am",
  Appointer: "/appointer",
  Bridge:    "/am",
  Closer:    "/am",
};

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated") {
      if (!session.user.setupCompleted) { router.replace("/setup"); return; }
      const dest = ROLE_TOP[session.user.role] ?? "/overview";
      router.replace(dest);
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">読み込み中...</p>
    </div>
  );
}
