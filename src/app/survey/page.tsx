"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { getSurveyWindow } from "@/lib/surveySchedule";

// ─── 型定義 ────────────────────────────────────────────────────────
interface Page {
  targetId: string;
  targetName?: string;
  targetRole?: string;
  type: "self" | "eval";
  submitted: boolean;
}

interface QuestionAnswer {
  score: number | null;
  reason: string;
}

const EMPTY_ANSWER: QuestionAnswer = { score: null, reason: "" };

// ─── 5段階評価ボタン ───────────────────────────────────────────────
const SCORE_LABELS: Record<number, string> = {
  5: "よくできている",
  4: "まあまあできている",
  3: "人並みにできている",
  2: "あまりできていない",
  1: "全くできていない",
};

function ScoreButton({ value, selected, onClick }: { value: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 w-full rounded-xl px-4 py-3 text-left text-sm border transition-all ${
        selected
          ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-sm"
          : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
      }`}
    >
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
        selected ? "bg-white text-indigo-600" : "bg-gray-100 text-gray-600"
      }`}>{value}</span>
      <span>{SCORE_LABELS[value]}</span>
    </button>
  );
}

// ─── 設問コンポーネント ─────────────────────────────────────────────
interface QuestionProps {
  number: number;
  question: string;
  answer: QuestionAnswer;
  showReason: boolean;
  onChange: (answer: QuestionAnswer) => void;
}

function Question({ number, question, answer, showReason, onChange }: QuestionProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-800">Q{number}. {question}</p>
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((v) => (
          <ScoreButton
            key={v}
            value={v}
            selected={answer.score === v}
            onClick={() => onChange({ ...answer, score: v })}
          />
        ))}
      </div>
      {showReason && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">その理由も記述してください</label>
          <Textarea
            value={answer.reason}
            onChange={(e) => onChange({ ...answer, reason: e.target.value })}
            placeholder="理由を入力してください..."
            className="text-sm resize-none"
            rows={3}
          />
        </div>
      )}
    </div>
  );
}

// ─── 設問定義 ──────────────────────────────────────────────────────
const APPOINTER_QUESTIONS = [
  "シート更新や日報を徹底してできましたか？",
  "アポインターマネージャーからもらったアドバイスを、進んで実践できましたか？その内容と理由を記述してください。",
  "自らチームに成功事例や情報の共有をすることができましたか？",
  "自ら業務改善（アポ獲得率を上げる）ために行動できましたか？",
];

const AM_EVAL_QUESTIONS = [
  "シート更新や日報を徹底してできていましたか？",
  "あなたのアドバイスを、進んで実践できていましたか？",
  "自らチームに成功事例や情報の共有をしていましたか？",
  "業務改善（アポ獲得率を上げる）ために進んで行動していましたか？",
];

const AM_SELF_QUESTIONS = [
  "シート更新や日報、議事録提出を徹底してできていましたか？",
  "ブリッジや責任者のアドバイスを、進んで実践できていましたか？",
  "自らチーム全体に成功事例や情報の共有をすることができましたか？",
  "業務改善（アポ獲得率を上げる）ために進んで行動できましたか？",
];

// 営業マンがアポインターを評価する設問
const SALES_APPOINTER_EVAL_QUESTIONS = [
  "シート更新や日報を徹底してできていましたか？",
  "アポインターマネージャーからのアドバイスを、進んで実践できていましたか？",
  "自らチームに成功事例や情報の共有をしていましたか？",
  "業務改善（アポ獲得率を上げる）ために進んで行動していましたか？",
];

// 営業マンがAMを評価する設問
const SALES_AM_EVAL_QUESTIONS = [
  "シート更新や日報を徹底してできていましたか？",
  "アポインターへのアドバイスを積極的に行い、チームを牽引できていましたか？",
  "自らチームに成功事例や情報の共有をしていましたか？",
  "業務改善（アポ獲得率を上げる・成約率を上げる）ために進んで行動していましたか？",
];

function getQuestions(role: string, type: "self" | "eval", targetRole?: string): string[] {
  if (role === "Appointer") return APPOINTER_QUESTIONS;
  if (role === "AM" && type === "eval")  return AM_EVAL_QUESTIONS;
  if (role === "AM" && type === "self")  return AM_SELF_QUESTIONS;
  if (role === "Sales") {
    if (targetRole === "Appointer") return SALES_APPOINTER_EVAL_QUESTIONS;
    return SALES_AM_EVAL_QUESTIONS; // AM or unspecified
  }
  return AM_EVAL_QUESTIONS;
}

function getIntro(role: string, type: "self" | "eval", targetName?: string, targetRole?: string): { title: string; body: string } {
  if (role === "Appointer") return {
    title: "月次アンケート",
    body: "日々のアポインター業務ありがとうございます！\n一緒に事業を盛り上げていけるように、月2回アンケートを取っています！\nご協力よろしくお願いします😌\n（所要時間4分）",
  };
  if (role === "AM" && type === "eval") return {
    title: `〜アポインター評価〜 ${targetName ?? ""}`,
    body: "日々のアポインター業務ありがとうございます！\n一緒に事業を盛り上げていけるように、1人1人のアポインターさんに関してアンケートを取っています。\nご協力よろしくお願いします😌\n（所要時間4分）",
  };
  if (role === "AM" && type === "self") return {
    title: "〜自己評価アンケート〜",
    body: "ここからは自分自身に関してのアンケートになります！\n1ヶ月の動きに対して振り返る機会にしてみてください！\n（所要時間4分）",
  };
  if (role === "Sales" && targetRole === "Appointer") return {
    title: `〜アポインター評価〜 ${targetName ?? ""}`,
    body: "日々の業務ありがとうございます！\n一緒に事業を盛り上げていけるように、1人1人のアポインターさんに関してアンケートを取っています。\nご協力よろしくお願いします😌\n（所要時間4分）",
  };
  if (role === "Sales") return {
    title: `〜AM評価アンケート〜 ${targetName ?? ""}`,
    body: "日々の業務ありがとうございます！\n一緒に事業を盛り上げていけるように、1人1人のアポインターマネージャーさんに関してアンケートを取っています。\nご協力よろしくお願いします😌\n（所要時間4分）",
  };
  return { title: "アンケート", body: "" };
}

// ─── メインコンテンツ（useSearchParams使用） ───────────────────────
function SurveyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amId = searchParams.get("amId"); // 営業マン向け: 特定AMグループのみ
  const { data: session, status } = useSession();

  const [pages, setPages]           = useState<Page[]>([]);
  const [pageIndex, setPageIndex]   = useState(0);
  const [answers, setAnswers]       = useState<QuestionAnswer[]>([EMPTY_ANSWER, EMPTY_ANSWER, EMPTY_ANSWER, EMPTY_ANSWER]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading]       = useState(true);

  const win = getSurveyWindow();

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
  }, [status, router]);

  const loadStatus = useCallback(async () => {
    if (status !== "authenticated") return;
    const { year, month } = win;
    const res = await fetch(`/api/survey?year=${year}&month=${month}`);
    if (!res.ok) { setLoading(false); return; }
    const d = await res.json();

    let targetPages: Page[] = [];

    if (amId && d.groups) {
      // 営業マン: 特定AMグループのページのみ
      const group = (d.groups as { amId: string; pages: Page[] }[]).find((g) => g.amId === amId);
      targetPages = group?.pages ?? [];
    } else {
      targetPages = d.pages ?? [];
    }

    setPages(targetPages);
    const firstUnsubmitted = targetPages.findIndex((p: Page) => !p.submitted);
    if (firstUnsubmitted >= 0) setPageIndex(firstUnsubmitted);
    else if (d.fullySubmitted || (amId && targetPages.every((p: Page) => p.submitted))) {
      router.replace("/survey/done");
      return;
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, win.year, win.month, amId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ページ変更時に回答をリセット
  useEffect(() => {
    setAnswers([EMPTY_ANSWER, EMPTY_ANSWER, EMPTY_ANSWER, EMPTY_ANSWER]);
  }, [pageIndex]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>;
  }

  if (pages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-lg font-bold text-gray-700">現在アンケートの回答期間外です</p>
          <p className="text-sm text-gray-500">アンケートは毎月1日〜5日に配信されます</p>
          <Button variant="outline" onClick={() => router.back()}>戻る</Button>
        </div>
      </div>
    );
  }

  const role = session?.user?.role ?? "Appointer";
  const currentPage = pages[pageIndex];
  if (!currentPage) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>ページがありません</p></div>;
  }

  const questions  = getQuestions(role, currentPage.type, currentPage.targetRole);
  const intro      = getIntro(role, currentPage.type, currentPage.targetName, currentPage.targetRole);
  const showReason = role === "Appointer";
  const allAnswered = answers.every((a) => a.score !== null);
  const isLastPage  = pageIndex === pages.length - 1;

  async function handleSubmit() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);

    const { year, month } = win;
    const body = {
      year, month,
      targetId:   currentPage.targetId,
      surveyType: currentPage.type,
      q1Score: answers[0].score, q1Reason: answers[0].reason,
      q2Score: answers[1].score, q2Reason: answers[1].reason,
      q3Score: answers[2].score, q3Reason: answers[2].reason,
      q4Score: answers[3].score, q4Reason: answers[3].reason,
    };

    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) { setSubmitting(false); alert("送信に失敗しました。もう一度お試しください。"); return; }

    if (isLastPage) {
      router.replace("/survey/done");
    } else {
      setPages((prev) => prev.map((p, i) => i === pageIndex ? { ...p, submitted: true } : p));
      setPageIndex((i) => i + 1);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-gray-900 text-sm">月次アンケート</h1>
            <span className="text-xs text-gray-400">
              {pageIndex + 1} / {pages.length} ページ
            </span>
          </div>
          {/* プログレスバー */}
          <div className="flex gap-1 mt-2">
            {pages.map((p, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  p.submitted ? "bg-green-500" : i === pageIndex ? "bg-indigo-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* イントロ */}
        <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
          <p className="font-bold text-indigo-800 text-base mb-2">{intro.title}</p>
          <p className="text-sm text-indigo-700 whitespace-pre-line leading-relaxed">{intro.body}</p>
        </div>

        {/* 締切 */}
        <p className="text-xs text-gray-400 text-center">
          締切: {win.deadline.getMonth() + 1}月{win.deadline.getDate()}日 23:59
          {win.daysLeft > 0 ? `（残り${win.daysLeft}日）` : "（本日締切）"}
        </p>

        {/* 設問 */}
        <div className="space-y-8">
          {questions.map((q, i) => (
            <Question
              key={i}
              number={i + 1}
              question={q}
              answer={answers[i]}
              showReason={showReason}
              onChange={(a) => setAnswers((prev) => prev.map((p, j) => j === i ? a : p))}
            />
          ))}
        </div>

        {/* ナビゲーション */}
        <div className="flex gap-3 pt-2 pb-8">
          {pageIndex > 0 && (
            <Button
              variant="outline"
              onClick={() => setPageIndex((i) => i - 1)}
              className="gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> 前のページ
            </Button>
          )}
          <Button
            className="flex-1 gap-1.5"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
          >
            {submitting ? "送信中..." : isLastPage ? "提出する" : "次のページへ"}
            {!isLastPage && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Suspense ラッパー（useSearchParams 必須） ──────────────────────
export default function SurveyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>}>
      <SurveyContent />
    </Suspense>
  );
}
