"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX, TrendingUp } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";

interface UserRecord {
  id: string;
  nickname?: string;
  name?: string;
  role: string;
  team?: string;
  line_picture_url?: string;
  icon_image_url?: string;
  completedStepCount: number;
  debuted: boolean;
  isChurned: boolean;
  dmCount: number;
  bSetCount: number;
}

interface PreDebutStep {
  step: number;
  count: number;
}

interface Summary {
  total: number;
  debuted: number;
  churned: number;
  preDebut: PreDebutStep[];
}

const TEAM_COLORS: Record<string, string> = {
  辻利: "#6366f1",
  LUMIA: "#ec4899",
  Covance: "#f59e0b",
};

const STEP_LABELS = [
  "未着手",
  "STEP 1",
  "STEP 2",
  "STEP 3",
  "STEP 4",
  "STEP 5",
];

export default function HRPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTeam, setFilterTeam] = useState<string>("全体");
  const [filterStatus, setFilterStatus] = useState<string>("全員");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!["Admin", "AM", "Sales"].includes(session?.user?.role ?? "")) {
      router.replace("/dashboard");
      return;
    }
    fetch("/api/hr")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users ?? []);
        setSummary(d.summary ?? null);
      })
      .finally(() => setLoading(false));
  }, [status, session, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  const teams = ["全体", ...Array.from(new Set(users.map((u) => u.team).filter(Boolean))) as string[]];

  const filtered = users.filter((u) => {
    if (filterTeam !== "全体" && u.team !== filterTeam) return false;
    if (filterStatus === "デビュー済み") return u.debuted && !u.isChurned;
    if (filterStatus === "デビュー前") return !u.debuted;
    if (filterStatus === "離脱") return u.isChurned;
    return true;
  });

  const appointers = filtered.filter((u) => u.role === "Appointer");
  const ams = filtered.filter((u) => u.role === "AM");

  const { nickname, name, image, role, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "ユーザー";

  return (
    <PageLayout title="人事評価" role={role ?? "Admin"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {/* ── サマリーカード ── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-500">アポインター総数</p>
                </div>
                <p className="text-3xl font-bold">{summary.total}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="w-4 h-4 text-green-500" />
                  <p className="text-xs text-gray-500">デビュー済み</p>
                </div>
                <p className="text-3xl font-bold text-green-600">{summary.debuted}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <p className="text-xs text-gray-500">デビュー前</p>
                </div>
                <p className="text-3xl font-bold text-indigo-600">
                  {summary.preDebut.reduce((s, p) => s + p.count, 0)}
                  <span className="text-base font-normal text-gray-500 ml-1">人</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserX className="w-4 h-4 text-red-400" />
                  <p className="text-xs text-gray-500">当月離脱</p>
                </div>
                <p className="text-3xl font-bold text-red-500">{summary.churned}<span className="text-base font-normal text-gray-500 ml-1">人</span></p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── デビュー前ステップ内訳 ── */}
        {summary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">デビュー前 — ステップ別人数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {summary.preDebut.map(({ step, count }) => (
                  <div key={step} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border">
                    <span className="text-xs font-medium text-gray-500">{STEP_LABELS[step] ?? `STEP ${step}`}</span>
                    <span className="text-lg font-bold text-indigo-600">{count}</span>
                    <span className="text-xs text-gray-400">人</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── フィルター ── */}
        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {teams.map((t) => (
              <button
                key={t}
                onClick={() => setFilterTeam(t)}
                className={`px-3 py-1.5 ${filterTeam === t ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {["全員", "デビュー済み", "デビュー前", "離脱"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 ${filterStatus === s ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── アポインター一覧 ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              アポインター一覧 <span className="font-normal text-gray-400 ml-1">({appointers.length}人)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {appointers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">該当するアポインターがいません</p>
            ) : (
              <div className="divide-y">
                {appointers.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── AM一覧 ── */}
        {ams.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">
                アポインターマネージャー <span className="font-normal text-gray-400 ml-1">({ams.length}人)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {ams.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}

function UserRow({ user: u }: { user: UserRecord }) {
  const avatar = u.icon_image_url ?? u.line_picture_url;
  const displayName = u.nickname ?? u.name ?? u.id;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <span className="text-xs text-gray-500">{displayName.charAt(0)}</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{displayName}</span>
          {u.team && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${TEAM_COLORS[u.team] ?? "#94a3b8"}20`,
                color: TEAM_COLORS[u.team] ?? "#64748b",
              }}
            >
              {u.team}
            </span>
          )}
          <StatusBadge user={u} />
        </div>
        {u.role === "Appointer" && !u.debuted && (
          <p className="text-xs text-gray-400 mt-0.5">
            {STEP_LABELS[u.completedStepCount] ?? `STEP ${u.completedStepCount}`} 完了
          </p>
        )}
      </div>

      {u.role === "Appointer" && (
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">DM / B設定</p>
          <p className="text-sm font-bold">
            {u.dmCount.toLocaleString()} / {u.bSetCount.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ user: u }: { user: UserRecord }) {
  if (u.role === "AM") return <Badge variant="outline" className="text-xs">AM</Badge>;
  if (u.isChurned) return <Badge className="bg-red-100 text-red-700 text-xs border-0">離脱</Badge>;
  if (u.debuted) return <Badge className="bg-green-100 text-green-700 text-xs border-0">デビュー済み</Badge>;
  return <Badge className="bg-indigo-100 text-indigo-700 text-xs border-0">デビュー前</Badge>;
}
