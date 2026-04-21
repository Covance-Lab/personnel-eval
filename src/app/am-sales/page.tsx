"use client";

/**
 * AM_Sales 兼任者 — 数値管理ダッシュボード
 *
 * 3セクション:
 *   1. チーム全体の合計（DM〜契約、ファネル）
 *   2. 自分管轄のアポインター合計
 *   3. 他AMが管理するアポインター合計
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TrendingUp, TrendingDown, Minus, Users, ChevronDown, ChevronUp } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";

// ─── 型 ────────────────────────────────────────────────────────────
interface PerfSection {
  appointerCount: number;
  dmCount: number;
  bSetCount: number;
  bSetRate: number;
}

interface FunnelSection {
  bExecCount: number;
  aSetCount: number;
  aExecCount: number;
  contractCount: number;
  bExecRate: number;
  aSetRate: number;
  aExecRate: number;
  contractRate: number;
}

interface StatsHalf {
  teamTotal: PerfSection;
  ownAppointers: PerfSection;
  otherAMs: PerfSection;
  funnel: FunnelSection;
}

interface StatsResponse {
  curr: StatsHalf;
  prev: StatsHalf;
  otherAMCount: number;
  team: string;
}

// ─── ユーティリティ ─────────────────────────────────────────────────
function Diff({ curr, prev, suffix = "" }: { curr: number; prev: number; suffix?: string }) {
  const diff = curr - prev;
  if (diff === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />前月同</span>;
  if (diff > 0)  return <span className="text-xs text-emerald-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{Math.abs(diff).toLocaleString()}{suffix}</span>;
  return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />−{Math.abs(diff).toLocaleString()}{suffix}</span>;
}

// ─── 数値カード ────────────────────────────────────────────────────
function StatCell({
  label,
  curr,
  prev,
  suffix = "",
  highlight = false,
}: {
  label: string;
  curr: number;
  prev: number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 p-3 rounded-xl ${highlight ? "bg-amber-50 border border-amber-100" : "bg-white border border-gray-100"}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-amber-700" : "text-gray-800"}`}>
        {curr.toLocaleString()}{suffix}
      </p>
      <Diff curr={curr} prev={prev} suffix={suffix} />
    </div>
  );
}

// ─── セクションカード ───────────────────────────────────────────────
function SectionCard({
  title,
  subtitle,
  accentColor,
  curr,
  prev,
  funnel,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  accentColor: string;
  curr: PerfSection;
  prev: PerfSection;
  funnel?: FunnelSection;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* ヘッダー */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-8 rounded-full" style={{ background: accentColor }} />
          <div className="text-left">
            <p className="text-sm font-bold text-gray-800">{title}</p>
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* アポインター数バッジ */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            <span>アポインター {curr.appointerCount}名</span>
          </div>

          {/* DM・B設定グリッド */}
          <div className="grid grid-cols-2 gap-2">
            <StatCell label="DM数" curr={curr.dmCount} prev={prev.dmCount} suffix="件" />
            <StatCell label="B設定" curr={curr.bSetCount} prev={prev.bSetCount} suffix="件" />
            <StatCell label="B設定率" curr={curr.bSetRate} prev={prev.bSetRate} suffix="%" />
            {funnel ? (
              <StatCell label="B実施" curr={funnel.bExecCount} prev={0} suffix="件" />
            ) : null}
          </div>

          {/* ファネル（チーム全体のみ） */}
          {funnel && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">商談ファネル</p>
              <div className="grid grid-cols-2 gap-2">
                <StatCell label="B実施率" curr={funnel.bExecRate} prev={0} suffix="%" />
                <StatCell label="A設定" curr={funnel.aSetCount} prev={0} suffix="件" />
                <StatCell label="A実施" curr={funnel.aExecCount} prev={0} suffix="件" />
                <StatCell label="契約" curr={funnel.contractCount} prev={0} suffix="件" highlight />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── メインページ ──────────────────────────────────────────────────
export default function AMSalesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && !["AM_Sales", "Admin"].includes(session.user.role)) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/am-sales/stats");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const userName = session?.user.nickname ?? session?.user.name ?? "";

  if (status === "loading" || loading) {
    return (
      <PageLayout role="AM_Sales" userName={userName}>
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      </PageLayout>
    );
  }

  if (!stats) {
    return (
      <PageLayout role="AM_Sales" userName={userName}>
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">データ取得に失敗しました</div>
      </PageLayout>
    );
  }

  const now = new Date();
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  return (
    <PageLayout role="AM_Sales" userName={userName}>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* ヘッダー */}
        <div>
          <p className="text-xs text-gray-400">{monthLabel}</p>
          <h1 className="text-lg font-bold text-gray-800">数値管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">チーム: {stats.team}</p>
        </div>

        {/* 1. チーム全体 */}
        <SectionCard
          title="チーム全体"
          subtitle={`${stats.team}チーム合計`}
          accentColor="#cfa340"
          curr={stats.curr.teamTotal}
          prev={stats.prev.teamTotal}
          funnel={stats.curr.funnel}
          defaultOpen
        />

        {/* 2. 自分管轄のアポインター */}
        <SectionCard
          title="自分管轄のアポインター"
          subtitle="自分が教育係のアポインター"
          accentColor="#6366f1"
          curr={stats.curr.ownAppointers}
          prev={stats.prev.ownAppointers}
          defaultOpen
        />

        {/* 3. 他AMが管理するアポインター */}
        <SectionCard
          title="他AM管轄のアポインター"
          subtitle={`同チームの他AM ${stats.otherAMCount}名が管理`}
          accentColor="#64748b"
          curr={stats.curr.otherAMs}
          prev={stats.prev.otherAMs}
          defaultOpen={false}
        />
      </div>
    </PageLayout>
  );
}
