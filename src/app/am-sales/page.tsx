"use client";

/**
 * AM_Sales 兼任者 — 数値管理ダッシュボード
 *
 * チーム全体: Salesページと同じ2列ペア形式 + 売上
 * 自分管轄 / 他AM管轄: プルダウン折り畳み
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Users } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";

// ─── 型 ────────────────────────────────────────────────────────────
interface Section {
  appointerCount: number;
  dmCount: number;
  bSetCount: number;   bSetRate: number;
  bExecCount: number;  bExecRate: number;
  aSetCount: number;   aSetRate: number;
  aExecCount: number;  aExecRate: number;
  contractCount: number; contractRate: number;
  revenue?: number;
}

interface StatsHalf {
  teamTotal: Section;
  ownAppointers: Section;
  otherAMs: Section;
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

// ─── 単一セル ─────────────────────────────────────────────────────
function StatCell({
  label, curr, prev, suffix, highlight = false,
}: {
  label: string; curr: number; prev: number; suffix: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${highlight ? "bg-amber-50 border-amber-100" : "bg-white"}`}>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-xl font-bold leading-none text-gray-900">
        {curr.toLocaleString()}
        <span className="text-xs font-normal text-gray-400 ml-0.5">{suffix}</span>
      </p>
      <Diff curr={curr} prev={prev} suffix={suffix} />
    </div>
  );
}

// ─── チーム全体カード（Salesページと同形式） ────────────────────────
function TeamCard({ curr, prev }: { curr: Section; prev: Section }) {
  type Pair = [
    { label: string; curr: number; prev: number; suffix: string; highlight?: boolean } | null,
    { label: string; curr: number; prev: number; suffix: string; highlight?: boolean } | null,
  ];

  const pairs: Pair[] = [
    [{ label: "DM数", curr: curr.dmCount,       prev: prev.dmCount,       suffix: "件" }, null],
    [
      { label: "B設定",   curr: curr.bSetCount,   prev: prev.bSetCount,   suffix: "件" },
      { label: "B設定率", curr: curr.bSetRate,    prev: prev.bSetRate,    suffix: "%" },
    ],
    [
      { label: "B実施",   curr: curr.bExecCount,  prev: prev.bExecCount,  suffix: "件" },
      { label: "B実施率", curr: curr.bExecRate,   prev: prev.bExecRate,   suffix: "%" },
    ],
    [
      { label: "A設定",   curr: curr.aSetCount,   prev: prev.aSetCount,   suffix: "件" },
      { label: "A設定率", curr: curr.aSetRate,    prev: prev.aSetRate,    suffix: "%" },
    ],
    [
      { label: "A実施",   curr: curr.aExecCount,  prev: prev.aExecCount,  suffix: "件" },
      { label: "A実施率", curr: curr.aExecRate,   prev: prev.aExecRate,   suffix: "%" },
    ],
    [
      { label: "契約",   curr: curr.contractCount, prev: prev.contractCount, suffix: "件", highlight: true },
      { label: "契約率", curr: curr.contractRate,  prev: prev.contractRate,  suffix: "%",  highlight: true },
    ],
    [
      { label: "売上", curr: curr.revenue ?? 0, prev: prev.revenue ?? 0, suffix: "円", highlight: true },
      null,
    ],
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-1 border-b border-gray-50 flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: "#cfa340" }} />
        <p className="text-sm font-bold text-gray-800">チーム全体</p>
        <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />{curr.appointerCount}名
        </span>
      </div>
      <div className="p-4 space-y-2">
        {pairs.map(([left, right], i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            {left  ? <StatCell {...left}  /> : <div />}
            {right ? <StatCell {...right} /> : <div />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 管轄別プルダウンカード ─────────────────────────────────────────
function SectionDropdown({
  title, subtitle, accentColor, curr, prev, defaultOpen = false,
}: {
  title: string; subtitle?: string; accentColor: string;
  curr: Section; prev: Section; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  type Pair = [
    { label: string; curr: number; prev: number; suffix: string } | null,
    { label: string; curr: number; prev: number; suffix: string } | null,
  ];

  const pairs: Pair[] = [
    [{ label: "DM数", curr: curr.dmCount, prev: prev.dmCount, suffix: "件" }, null],
    [
      { label: "B設定",   curr: curr.bSetCount,    prev: prev.bSetCount,    suffix: "件" },
      { label: "B設定率", curr: curr.bSetRate,     prev: prev.bSetRate,     suffix: "%" },
    ],
    [
      { label: "B実施",   curr: curr.bExecCount,   prev: prev.bExecCount,   suffix: "件" },
      { label: "B実施率", curr: curr.bExecRate,    prev: prev.bExecRate,    suffix: "%" },
    ],
    [
      { label: "A設定",   curr: curr.aSetCount,    prev: prev.aSetCount,    suffix: "件" },
      { label: "A設定率", curr: curr.aSetRate,     prev: prev.aSetRate,     suffix: "%" },
    ],
    [
      { label: "A実施",   curr: curr.aExecCount,   prev: prev.aExecCount,   suffix: "件" },
      { label: "A実施率", curr: curr.aExecRate,    prev: prev.aExecRate,    suffix: "%" },
    ],
    [
      { label: "契約",   curr: curr.contractCount, prev: prev.contractCount, suffix: "件" },
      { label: "契約率", curr: curr.contractRate,  prev: prev.contractRate,  suffix: "%" },
    ],
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3"
      >
        <div className="w-1 h-6 rounded-full shrink-0" style={{ background: accentColor }} />
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-gray-800">{title}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <span className="text-xs text-gray-400 mr-2 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />{curr.appointerCount}名
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
          {pairs.map(([left, right], i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              {left  ? <StatCell {...left}  /> : <div />}
              {right ? <StatCell {...right} /> : <div />}
            </div>
          ))}
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
          <p className="text-xs text-gray-400">{monthLabel}（前月比）</p>
          <h1 className="text-lg font-bold text-gray-800">数値管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">{stats.team}チーム</p>
        </div>

        {/* 1. チーム全体（Salesと同形式） */}
        <TeamCard curr={stats.curr.teamTotal} prev={stats.prev.teamTotal} />

        {/* 2. 自分管轄のアポインター（プルダウン） */}
        <SectionDropdown
          title="自分管轄のアポインター"
          subtitle="自分が教育係のアポインター"
          accentColor="#6366f1"
          curr={stats.curr.ownAppointers}
          prev={stats.prev.ownAppointers}
          defaultOpen
        />

        {/* 3. 他AM管轄のアポインター（プルダウン） */}
        <SectionDropdown
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
