"use client";

import { useState, useMemo } from "react";
import { Shield, Search, Filter, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SummaryStats from "@/components/dashboard/SummaryStats";
import AppointersCard from "@/components/dashboard/AppointersCard";
import { mockAppointors, mockAMs, getRiskSummary } from "@/data/mockData";
import type { ChurnRiskLevel, AppointersStatus } from "@/types/evaluation";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<ChurnRiskLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AppointersStatus | "all">("all");
  const [amFilter, setAmFilter] = useState<string>("all");

  const summary = getRiskSummary();

  const amMap = useMemo(() => {
    const m: Record<string, string> = {};
    mockAMs.forEach((am) => { m[am.id] = am.name; });
    return m;
  }, []);

  const filtered = useMemo(() => {
    return mockAppointors.filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (riskFilter !== "all" && a.churnRisk !== riskFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (amFilter !== "all" && a.amId !== amFilter) return false;
      return true;
    }).sort((a, b) => b.churnRiskScore - a.churnRiskScore);
  }, [search, riskFilter, statusFilter, amFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                アポインター評価・離脱防止管理
              </h1>
              <p className="text-xs text-gray-500">
                6軸評価システム — 本人評価 / AM評価
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* サマリー統計 */}
        <SummaryStats {...summary} />

        {/* フィルターバー */}
        <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 p-4">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />

          {/* 検索 */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="名前で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* リスクフィルター */}
          <Select
            value={riskFilter}
            onValueChange={(v) => setRiskFilter(v as ChurnRiskLevel | "all")}
          >
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="リスク" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全リスク</SelectItem>
              <SelectItem value="low">低リスク</SelectItem>
              <SelectItem value="medium">中リスク</SelectItem>
              <SelectItem value="high">高リスク</SelectItem>
              <SelectItem value="critical">要対応</SelectItem>
            </SelectContent>
          </Select>

          {/* ステータスフィルター */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as AppointersStatus | "all")}
          >
            <SelectTrigger className="h-9 w-32 text-sm">
              <SelectValue placeholder="ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全ステータス</SelectItem>
              <SelectItem value="active">稼働中</SelectItem>
              <SelectItem value="inactive">非稼働</SelectItem>
              <SelectItem value="on_leave">休暇中</SelectItem>
              <SelectItem value="resigned">退職済</SelectItem>
            </SelectContent>
          </Select>

          {/* AMフィルター */}
          <Select value={amFilter} onValueChange={(v) => setAmFilter(v ?? "all")}>
            <SelectTrigger className="h-9 w-40 text-sm">
              <SelectValue placeholder="AM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全AM</SelectItem>
              {mockAMs.map((am) => (
                <SelectItem key={am.id} value={am.id}>
                  {am.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
            <Users className="w-3.5 h-3.5" />
            {filtered.length}件
          </div>
        </div>

        {/* アポインターカード一覧 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>条件に一致するアポインターがいません</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((a) => (
              <AppointersCard key={a.id} appointer={a} amName={amMap[a.amId]} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
