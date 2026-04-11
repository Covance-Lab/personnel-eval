"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

interface MonthRecord {
  year: number;
  month: number;
  dmCount: number;
  appoCount: number;
  appointmentRate: number;
}

export default function AppointerHistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [records, setRecords] = useState<MonthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session?.user?.role !== "Appointer") router.replace("/dashboard");
  }, [status, session, router]);

  const loadData = useCallback(async () => {
    if (status !== "authenticated") return;
    const myId = session?.user?.dbId;
    if (!myId) { setLoading(false); return; }

    try {
      const res = await fetch(`/api/performance?userId=${myId}`);
      if (res.ok) {
        const { records: rows } = await res.json();
        const recs: MonthRecord[] = (rows ?? [])
          .map((r: Record<string, unknown>) => ({
            year:            r.year as number,
            month:           r.month as number,
            dmCount:         r.dm_count as number,
            appoCount:       r.appo_count as number,
            appointmentRate: Number(r.appointment_rate),
          }))
          .sort((a: MonthRecord, b: MonthRecord) =>
            a.year !== b.year ? a.year - b.year : a.month - b.month
          );
        setRecords(recs);
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
  const userName = nickname ?? name ?? "アポインター";

  const chartData = records.map((r) => ({
    label: `${r.year}/${String(r.month).padStart(2, "0")}`,
    DM数: r.dmCount,
    B設定数: r.appoCount,
    "B設定率(%)": r.appointmentRate,
  }));

  return (
    <PageLayout title="実績管理" role={role ?? "Appointer"} userName={userName} userImage={image} userTeam={team}>
      <div className="space-y-6">

        {records.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              実績データがありません。スプレッドシートを同期してください。
            </CardContent>
          </Card>
        ) : (
          <>
            {/* DM・B設定数グラフ */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">DM数 / B設定数の推移</CardTitle>
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

            {/* B設定率グラフ */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">B設定率(%)の推移</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip />
                    <Bar dataKey="B設定率(%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 月別テーブル */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">月別実績一覧</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y text-sm">
                  <div className="grid grid-cols-4 px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                    <span>年月</span><span className="text-right">DM数</span><span className="text-right">B設定数</span><span className="text-right">B設定率</span>
                  </div>
                  {[...records].reverse().map((r) => (
                    <div key={`${r.year}-${r.month}`} className="grid grid-cols-4 px-4 py-3">
                      <span className="text-gray-600">{r.year}年{r.month}月</span>
                      <span className="text-right font-medium">{r.dmCount.toLocaleString()}</span>
                      <span className="text-right font-medium">{r.appoCount.toLocaleString()}</span>
                      <span className="text-right font-medium">{r.appointmentRate}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

      </div>
    </PageLayout>
  );
}
