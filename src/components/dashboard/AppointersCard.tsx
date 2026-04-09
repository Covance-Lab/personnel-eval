"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { User, Calendar, MessageSquare, TrendingUp } from "lucide-react";
import ChurnRiskBadge from "./ChurnRiskBadge";
import EvaluationRadarChart from "@/components/evaluation/RadarChart";
import EvaluationScoreTable from "@/components/evaluation/EvaluationScoreTable";
import ScoreTrendChart from "@/components/evaluation/ScoreTrendChart";
import {
  STATUS_CONFIG,
  type Appointer,
} from "@/types/evaluation";
import { getLatestEvaluation } from "@/data/mockData";

interface Props {
  appointer: Appointer;
  amName?: string;
}

export default function AppointersCard({ appointer, amName }: Props) {
  const [open, setOpen] = useState(false);
  const latest = getLatestEvaluation(appointer);
  const statusConfig = STATUS_CONFIG[appointer.status];

  const joinDate = new Date(appointer.joinedAt);
  const months =
    (new Date().getFullYear() - joinDate.getFullYear()) * 12 +
    (new Date().getMonth() - joinDate.getMonth());

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
        style={{
          borderLeftColor:
            appointer.churnRisk === "critical"
              ? "#ef4444"
              : appointer.churnRisk === "high"
              ? "#f97316"
              : appointer.churnRisk === "medium"
              ? "#eab308"
              : "#22c55e",
        }}
        onClick={() => setOpen(true)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-base">{appointer.name}</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">{amName && `担当AM: ${amName}`}</p>
              </div>
            </div>
            <ChurnRiskBadge level={appointer.churnRisk} score={appointer.churnRiskScore} showScore />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span
              className={`px-2 py-0.5 rounded-full font-semibold ${statusConfig.color} ${statusConfig.bgColor}`}
            >
              {statusConfig.label}
            </span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {months}ヶ月
            </div>
          </div>

          {/* 離脱リスクスコアバー */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>離脱リスクスコア</span>
              <span className="font-semibold">{appointer.churnRiskScore} / 100</span>
            </div>
            <Progress
              value={appointer.churnRiskScore}
              className="h-1.5"
            />
          </div>

          {/* 最新評価スコア */}
          {latest && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-indigo-50 rounded-lg p-2 text-center">
                <p className="text-xs text-indigo-600 font-medium">本人評価</p>
                <p className="text-lg font-bold text-indigo-800">
                  {latest.overallSelfScore ?? "－"}
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 text-center">
                <p className="text-xs text-amber-600 font-medium">AM評価</p>
                <p className="text-lg font-bold text-amber-800">
                  {latest.overallAmScore ?? "－"}
                </p>
              </div>
            </div>
          )}

          {/* リスク要因 */}
          {appointer.churnRiskFactors.length > 0 && (
            <div className="pt-1">
              {appointer.churnRiskFactors.slice(0, 2).map((f, i) => (
                <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                  <span className="mt-0.5">•</span>
                  {f}
                </p>
              ))}
              {appointer.churnRiskFactors.length > 2 && (
                <p className="text-xs text-gray-400">
                  他 {appointer.churnRiskFactors.length - 2} 件
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 詳細ダイアログ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <span>{appointer.name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <ChurnRiskBadge level={appointer.churnRisk} score={appointer.churnRiskScore} showScore />
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusConfig.color} ${statusConfig.bgColor}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="latest" className="mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="latest">最新評価</TabsTrigger>
              <TabsTrigger value="trend">推移</TabsTrigger>
              <TabsTrigger value="info">基本情報</TabsTrigger>
            </TabsList>

            {/* 最新評価タブ */}
            <TabsContent value="latest" className="space-y-4 mt-4">
              {latest ? (
                <>
                  <p className="text-sm text-gray-500">
                    {latest.period.year}年{latest.period.month}月 評価
                  </p>
                  <EvaluationRadarChart scores={latest.scores} />
                  <EvaluationScoreTable scores={latest.scores} />
                </>
              ) : (
                <p className="text-gray-400 text-center py-8">評価データがありません</p>
              )}
            </TabsContent>

            {/* 推移タブ */}
            <TabsContent value="trend" className="space-y-4 mt-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  総合スコア推移
                </p>
                <ScoreTrendChart evaluations={appointer.evaluations} />
              </div>
            </TabsContent>

            {/* 基本情報タブ */}
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">メール</p>
                  <p className="font-medium mt-0.5">{appointer.email}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">電話</p>
                  <p className="font-medium mt-0.5">{appointer.phone ?? "未登録"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">入社日</p>
                  <p className="font-medium mt-0.5">
                    {new Date(appointer.joinedAt).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">勤続</p>
                  <p className="font-medium mt-0.5">{months}ヶ月</p>
                </div>
              </div>

              {/* リスク要因 */}
              {appointer.churnRiskFactors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">離脱リスク要因</p>
                  <ul className="space-y-1">
                    {appointer.churnRiskFactors.map((f, i) => (
                      <li key={i} className="text-sm text-red-600 flex items-start gap-1.5 bg-red-50 rounded px-3 py-1.5">
                        <span className="mt-0.5">⚠</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AMメモ */}
              {appointer.notes && (
                <div className="bg-yellow-50 rounded-lg p-3">
                  <p className="text-xs text-yellow-700 font-medium flex items-center gap-1 mb-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    AMメモ
                  </p>
                  <p className="text-sm text-gray-700">{appointer.notes}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
