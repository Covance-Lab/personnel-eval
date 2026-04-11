"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageLayout from "@/components/layout/PageLayout";
import { getRoleLabel } from "@/lib/profilePermissions";
import type { Role } from "@/types/user";

interface MentorUser {
  id: string;
  nickname?: string;
  name?: string;
  role: Role;
  team?: string;
  line_picture_url?: string;
  icon_image_url?: string;
  age?: number | null;
  gender?: string | null;
  hobbies?: string | null;
  self_introduction?: string | null;
}

const ROLE_COLOR: Record<string, string> = {
  AM:     "bg-indigo-100 text-indigo-700",
  Sales:  "bg-amber-100 text-amber-700",
  Closer: "bg-emerald-100 text-emerald-700",
  Bridge: "bg-purple-100 text-purple-700",
};

function MentorCard({ user: u }: { user: MentorUser }) {
  const avatar      = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={displayName} className="w-14 h-14 rounded-full object-cover shrink-0 border" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-gray-500">{displayName.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-gray-900">{displayName}</p>
              <Badge className={`text-xs border-0 ${ROLE_COLOR[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                {getRoleLabel(u.role)}
              </Badge>
              {u.team && <Badge variant="outline" className="text-xs">{u.team}</Badge>}
            </div>
            {u.age && (
              <p className="text-xs text-gray-500">
                {u.age}歳{u.gender ? ` · ${u.gender}` : ""}
              </p>
            )}
            {u.hobbies && (
              <p className="text-xs text-gray-500">
                趣味: {u.hobbies}
              </p>
            )}
            {u.self_introduction && (
              <p className="text-xs text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap">
                {u.self_introduction}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AppointerMentorsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [mentors, setMentors] = useState<MentorUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session?.user?.role !== "Appointer") router.replace("/dashboard");
  }, [status, session, router]);

  const loadData = useCallback(async () => {
    if (status !== "authenticated") return;
    const myId = session?.user?.dbId;
    const team = session?.user?.team;
    if (!myId) { setLoading(false); return; }

    try {
      // 自分の担当AMを取得（education_mentor_user_id）
      // + 同チームのSales / Closerも取得
      const [amRes, salesRes] = await Promise.all([
        fetch(`/api/user/list?role=AM&mentorOf=${myId}&fields=id,nickname,name,role,team,line_picture_url,icon_image_url,age,gender,hobbies,self_introduction`),
        team
          ? fetch(`/api/user/list?roles=Sales,Closer&team=${encodeURIComponent(team)}&fields=id,nickname,name,role,team,line_picture_url,icon_image_url,age,gender,hobbies,self_introduction`)
          : Promise.resolve(null),
      ]);

      const result: MentorUser[] = [];
      if (amRes.ok) {
        const d = await amRes.json();
        result.push(...(d.users ?? []));
      }
      if (salesRes?.ok) {
        const d = await salesRes.json();
        result.push(...(d.users ?? []));
      }

      // 重複除去
      const seen = new Set<string>();
      setMentors(result.filter((u) => { if (seen.has(u.id)) return false; seen.add(u.id); return true; }));
    } finally {
      setLoading(false);
    }
  }, [status, session]);

  useEffect(() => { loadData(); }, [loadData]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>;
  }

  const { nickname, name, image, role, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "アポインター";

  const ams     = mentors.filter((u) => u.role === "AM");
  const sales   = mentors.filter((u) => u.role === "Sales");
  const closers = mentors.filter((u) => u.role === "Closer");

  return (
    <PageLayout title="担当者のプロフィール" role={role ?? "Appointer"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {mentors.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              担当者情報がありません。管理者にロール設定を依頼してください。
            </CardContent>
          </Card>
        )}

        {ams.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-600">担当アポインターマネージャー</p>
            {ams.map((u) => <MentorCard key={u.id} user={u} />)}
          </section>
        )}

        {sales.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-600">チームの営業マン</p>
            {sales.map((u) => <MentorCard key={u.id} user={u} />)}
          </section>
        )}

        {closers.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-600">クローザー</p>
            {closers.map((u) => <MentorCard key={u.id} user={u} />)}
          </section>
        )}

      </div>
    </PageLayout>
  );
}
