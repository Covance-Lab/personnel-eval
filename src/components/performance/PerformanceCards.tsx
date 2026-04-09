"use client";

import { MessageSquare, Trophy, Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PerformanceRecord } from "@/types/performance";

interface Props {
  current: PerformanceRecord | null;
  previous?: PerformanceRecord | null;
}

// 増減インジケーター
function Delta({
  current,
  previous,
  suffix = "",
}: {
  current: number;
  previous?: number | null;
  suffix?: string;
}) {
  if (previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />前月比なし</span>;
  if (diff > 0)
    return (
      <span className="text-xs text-green-600 flex items-center gap-0.5">
        <TrendingUp className="w-3 h-3" />+{diff.toLocaleString()}{suffix}
      </span>
    );
  return (
    <span className="text-xs text-red-500 flex items-center gap-0.5">
      <TrendingDown className="w-3 h-3" />{diff.toLocaleString()}{suffix}
    </span>
  );
}

export default function PerformanceCards({ current, previous }: Props) {
  if (!current) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {["今月の累計DM数", "アポ獲得数", "見込み月収"].map((label) => (
          <Card key={label} className="bg-gray-50 border-dashed">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-400">{label}</p>
              <p className="text-2xl font-bold text-gray-300 mt-1">－</p>
              <p className="text-xs text-gray-300 mt-1">データ未取得</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "今月の累計DM数",
      value: current.dmCount.toLocaleString(),
      unit: "件",
      icon: MessageSquare,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      iconBg: "bg-indigo-100",
      delta: <Delta current={current.dmCount} previous={previous?.dmCount} suffix="件" />,
    },
    {
      label: "アポ獲得数",
      value: current.appoCount.toLocaleString(),
      unit: `件 (${current.appointmentRate}%)`,
      icon: Trophy,
      color: "text-amber-600",
      bg: "bg-amber-50",
      iconBg: "bg-amber-100",
      delta: <Delta current={current.appoCount} previous={previous?.appoCount} suffix="件" />,
    },
    {
      label: "見込み月収",
      value: current.income.toLocaleString(),
      unit: "円",
      icon: Wallet,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      iconBg: "bg-emerald-100",
      delta: <Delta current={current.income} previous={previous?.income} suffix="円" />,
      expectedIncome: current.expectedIncome,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const belowExpected =
          "expectedIncome" in card &&
          card.expectedIncome &&
          current.income < card.expectedIncome;

        return (
          <Card
            key={card.label}
            className={`${card.bg} border-0 ${belowExpected ? "ring-1 ring-red-300" : ""}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-medium ${card.color}`}>{card.label}</p>
                  <div className="flex items-end gap-1 mt-1">
                    <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                    <p className={`text-xs mb-0.5 ${card.color} opacity-70`}>{card.unit}</p>
                  </div>
                  <div className="mt-1">{card.delta}</div>
                  {"expectedIncome" in card && card.expectedIncome && (
                    <p
                      className={`text-xs mt-1 ${
                        belowExpected ? "text-red-600 font-semibold" : "text-gray-400"
                      }`}
                    >
                      期待額: {card.expectedIncome.toLocaleString()}円
                      {belowExpected && " ⚠ 未達"}
                    </p>
                  )}
                </div>
                <div className={`${card.iconBg} rounded-lg p-2 shrink-0`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
