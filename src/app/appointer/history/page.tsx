"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

interface MonthRecord {
  year:            number;
  month:           number;
  dmCount:         number;
  appoCount:       number;
  appointmentRate: number;
}

type MetricKey = "DM数" | "B設定数" | "B設定率(%)";
const COUNT_METRICS: MetricKey[] = ["DM数", "B設定数"];
const RATE_METRICS:  MetricKey[] = ["B設定率(%)"];
const METRIC_COLOR: Record<MetricKey, string> = {
  "DM数":      "#6366f1",
  "B設定数":   "#ec4899",
  "B設定率(%)": "#22c55e",
};

function PerformanceChart({ data }: { data: Record<string, number | string>[] }) {
  const [active, setActive] = useState<Set<MetricKey>>(new Set(["DM数", "B設定数"]));

  function toggle(m: MetricKey) {
    const mIsRate = RATE_METRICS.includes(m);
    setActive((prev) => {
      const next = new Set(prev);
      const prevHasRate = [...prev].some((k) => RATE_METRICS.includes(k));
      if (mIsRate && !prevHasRate) return new Set([m]);
      if (!mIsRate && prevHasRate)  return new Set([m]);
      if (next.has(m)) { next.delete(m); if (next.size === 0) next.add(m); }
      else { next.add(m); }
      return next;
    });
  }

  const isRateMode = [...active].some((k) => RATE_METRICS.includes(k));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700">実績推移</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* フィルター */}
        <div className="space-y-1.5">
          <div>
            <p className="text-xs text-gray-400 mb-1">件数（同時選択可）</p>
            <div className="flex gap-1.5 flex-wrap">
              {COUNT_METRICS.map((m) => {
                const on = active.has(m);
                return (
                  <button key={m} onClick={() => toggle(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200"
                    }`}
                    style={on ? { backgroundColor: METRIC_COLOR[m] } : {}}
                  >{m}</button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">率（件数と同時表示不可）</p>
            <div className="flex gap-1.5 flex-wrap">
              {RATE_METRICS.map((m) => {
                const on = active.has(m);
                return (
                  <button key={m} onClick={() => toggle(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200"
                    }`}
                    style={on ? { backgroundColor: METRIC_COLOR[m] } : {}}
                  >{m}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 折れ線グラフ */}
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              unit={isRateMode ? "%" : ""}
              tickFormatter={(v) => {
                if (!isRateMode && v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                return String(v);
              }}
            />
            <Tooltip formatter={(value, name) => [
              isRateMode ? `${value}%` : `${Number(value).toLocaleString()}件`,
              name,
            ]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {([...active] as MetricKey[]).map((m) => (
              <Line key={m} type="monotone" dataKey={m}
                stroke={METRIC_COLOR[m]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
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
    label:         `${r.year}/${String(r.month).padStart(2, "0")}`,
    "DM数":        r.dmCount,
    "B設定数":     r.appoCount,
    "B設定率(%)":  r.appointmentRate,
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
            {/* 折れ線グラフ（フィルター付き） */}
            <PerformanceChart data={chartData} />

            {/* 月別テーブル */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">月別実績一覧</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y text-sm">
                  <div className="grid grid-cols-4 px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                    <span>年月</span>
                    <span className="text-right">DM数</span>
                    <span className="text-right">B設定数</span>
                    <span className="text-right">B設定率</span>
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
