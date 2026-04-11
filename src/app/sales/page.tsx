"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import SurveyNotice from "@/components/survey/SurveyNotice";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line,
} from "recharts";

interface MonthRecord {
  year: number;
  month: number;
  dmCount: number;
  appoCount: number;
}

interface AggregateRecord {
  year: number;
  month: number;
  bExecCount: number;
  aSetCount: number;
  aExecCount: number;
  contractCount: number;
  revenue: number;
}

function Diff({ curr, prev, suffix = "" }: { curr: number; prev: number; suffix?: string }) {
  const diff = curr - prev;
  if (diff === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />前月同</span>;
  if (diff > 0) return <span className="text-xs text-green-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{diff.toLocaleString()}{suffix}</span>;
  return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{diff.toLocaleString()}{suffix}</span>;
}

function StatBox({ label, curr, prev, suffix = "" }: { label: string; curr: number; prev: number; suffix?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 space-y-1">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{curr.toLocaleString()}<span className="text-base font-normal text-gray-400 ml-0.5">{suffix}</span></p>
      <Diff curr={curr} prev={prev} suffix={suffix} />
    </div>
  );
}

export default function SalesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [teamRecords, setTeamRecords] = useState<MonthRecord[]>([]);
  const [aggregates, setAggregates]   = useState<AggregateRecord[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session?.user?.role !== "Sales") router.replace("/dashboard");
  }, [status, session, router]);

  const loadData = useCallback(async () => {
    if (status !== "authenticated") return;
    const team = session?.user?.team;
    if (!team) { setLoading(false); return; }

    try {
      const [statsRes, aggRes] = await Promise.all([
        fetch(`/api/stats?team=${encodeURIComponent(team)}`),
        fetch("/api/aggregates"),
      ]);
      if (statsRes.ok) {
        const d = await statsRes.json();
        // trend配列から月次実績を組み立て
        const recs: MonthRecord[] = (d.trend ?? []).map((t: { year: number; month: number; overall: { dmCount: number; appoCount?: number; bSetCount?: number } }) => ({
          year: t.year,
          month: t.month,
          dmCount: t.overall.dmCount,
          appoCount: t.overall.bSetCount ?? 0,
        }));
        setTeamRecords(recs);
      }
      if (aggRes.ok) {
        const d = await aggRes.json();
        setAggregates(d.aggregates ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [status, session]);

  useEffect(() => { loadData(); }, [loadData]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>;
  }

  const { nickname, name, image, role, team } = session?.user ?? {};
  const userName = nickname ?? name ?? "営業マン";

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const prevDate  = new Date(thisYear, thisMonth - 2, 1);
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  const currRec = teamRecords.find((r) => r.year === thisYear && r.month === thisMonth);
  const prevRec = teamRecords.find((r) => r.year === prevYear && r.month === prevMonth);
  const currAgg = aggregates.find((a) => a.year === thisYear && a.month === thisMonth);
  const prevAgg = aggregates.find((a) => a.year === prevYear && a.month === prevMonth);

  // グラフ用（直近6ヶ月）
  const recent6 = teamRecords.slice(-6);
  const chartData = recent6.map((r) => {
    const agg = aggregates.find((a) => a.year === r.year && a.month === r.month);
    return {
      label: `${r.year}/${String(r.month).padStart(2, "0")}`,
      DM数: r.dmCount,
      B設定数: r.appoCount,
      B実施数: agg?.bExecCount ?? 0,
      A設定数: agg?.aSetCount ?? 0,
      A実施数: agg?.aExecCount ?? 0,
    };
  });

  const myDbId = session?.user?.dbId ?? "";

  return (
    <PageLayout title="チーム実績" role={role ?? "Sales"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {/* アンケート通知 */}
        <SurveyNotice userId={myDbId} />

        <div>
          <p className="text-xs text-gray-400 mb-3">{team} · {thisYear}年{thisMonth}月</p>
          {/* 今月の数字 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatBox label="DM数"   curr={currRec?.dmCount   ?? 0} prev={prevRec?.dmCount   ?? 0} suffix="件" />
            <StatBox label="B設定数（アポ）" curr={currRec?.appoCount ?? 0} prev={prevRec?.appoCount ?? 0} suffix="件" />
            <StatBox label="B実施数" curr={currAgg?.bExecCount ?? 0} prev={prevAgg?.bExecCount ?? 0} suffix="件" />
            <StatBox label="A設定数" curr={currAgg?.aSetCount  ?? 0} prev={prevAgg?.aSetCount  ?? 0} suffix="件" />
            <StatBox label="A実施数" curr={currAgg?.aExecCount ?? 0} prev={prevAgg?.aExecCount ?? 0} suffix="件" />
            <StatBox label="契約数"  curr={currAgg?.contractCount ?? 0} prev={prevAgg?.contractCount ?? 0} suffix="件" />
          </div>
        </div>

        {/* 月次グラフ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">過去6ヶ月の推移</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="DM数" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="B設定数" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">商談・成約推移</CardTitle>
            <p className="text-xs text-gray-400">集計シートから同期したデータ</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="B実施数" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="A設定数" stroke="#ec4899" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="A実施数" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </PageLayout>
  );
}
