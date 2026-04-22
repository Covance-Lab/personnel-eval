"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  featured_image_1_url?: string | null;
  featured_image_2_url?: string | null;
}

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  AM:       { bg: "#e0e7ff", text: "#4338ca" },
  AM_Sales: { bg: "#ccfbf1", text: "#0f766e" },
  Sales:    { bg: "#fef3c7", text: "#92400e" },
  Closer:   { bg: "#d1fae5", text: "#065f46" },
  Bridge:   { bg: "#ede9fe", text: "#6d28d9" },
};

function MentorRow({ user: u }: { user: MentorUser }) {
  const [open, setOpen] = useState(false);
  const avatar      = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;
  const roleStyle   = ROLE_COLOR[u.role] ?? { bg: "#f3f4f6", text: "#374151" };
  const hasBothPhotos = !!(u.featured_image_1_url && u.featured_image_2_url);

  const infoRows = [
    { label: "役割",  value: getRoleLabel(u.role) },
    { label: "チーム", value: u.team ?? "—" },
    { label: "年齢",  value: u.age ? `${u.age}歳` : "—" },
    { label: "性別",  value: u.gender ?? "—" },
    { label: "趣味",  value: u.hobbies?.trim() || "—" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ヘッダー行（クリックで展開） */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={displayName} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-gray-100" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-gray-500">{displayName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-gray-900">{displayName}</p>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: roleStyle.bg, color: roleStyle.text }}
            >
              {getRoleLabel(u.role)}
            </span>
            {u.team && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {u.team}
              </span>
            )}
          </div>
          {u.self_introduction && !open && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{u.self_introduction}</p>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        }
      </button>

      {/* 展開時の詳細 */}
      {open && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
          {/* 基本情報 */}
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            {infoRows.map(({ label, value }, i) => (
              <div key={label} className={`flex items-center gap-3 py-2 text-sm ${i < infoRows.length - 1 ? "border-b border-gray-100" : ""}`}>
                <span className="text-gray-400 text-xs w-12 shrink-0">{label}</span>
                <span className="text-gray-800 font-medium">{value}</span>
              </div>
            ))}
          </div>

          {/* 自己紹介 */}
          {u.self_introduction?.trim() && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">自己紹介</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl px-4 py-3">
                {u.self_introduction}
              </p>
            </div>
          )}

          {/* イチオシ写真 */}
          {(u.featured_image_1_url || u.featured_image_2_url) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">イチオシ写真</p>
              <div className={`grid gap-2 ${hasBothPhotos ? "grid-cols-2" : "grid-cols-1"}`}>
                {u.featured_image_1_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.featured_image_1_url} alt="写真1" className="w-full rounded-xl border border-gray-100 shadow-sm" style={{ display: "block" }} />
                )}
                {u.featured_image_2_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.featured_image_2_url} alt="写真2" className="w-full rounded-xl border border-gray-100 shadow-sm" style={{ display: "block" }} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
      const [amRes, salesRes] = await Promise.all([
        fetch(`/api/user/list?role=AM&mentorOf=${myId}&fields=id,nickname,name,role,team,line_picture_url,icon_image_url,age,gender,hobbies,self_introduction,featured_image_1_url,featured_image_2_url`),
        team
          ? fetch(`/api/user/list?roles=Sales,Closer&team=${encodeURIComponent(team)}&fields=id,nickname,name,role,team,line_picture_url,icon_image_url,age,gender,hobbies,self_introduction,featured_image_1_url,featured_image_2_url`)
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

  const ams     = mentors.filter((u) => u.role === "AM" || u.role === "AM_Sales");
  const sales   = mentors.filter((u) => u.role === "Sales");
  const closers = mentors.filter((u) => u.role === "Closer");

  return (
    <PageLayout title="担当者のプロフィール" role={role ?? "Appointer"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {mentors.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400 text-sm">
            担当者情報がありません。管理者にロール設定を依頼してください。
          </div>
        )}

        {ams.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-600">担当アポインターマネージャー</p>
            {ams.map((u) => <MentorRow key={u.id} user={u} />)}
          </section>
        )}

        {sales.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-600">チームの営業マン</p>
            {sales.map((u) => <MentorRow key={u.id} user={u} />)}
          </section>
        )}

        {closers.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-600">クローザー</p>
            {closers.map((u) => <MentorRow key={u.id} user={u} />)}
          </section>
        )}

      </div>
    </PageLayout>
  );
}
