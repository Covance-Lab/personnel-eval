/**
 * アポインター評価・離脱防止管理システム
 * 評価軸の型定義
 */

/** 評価スコア (1〜5) */
export type Score = 1 | 2 | 3 | 4 | 5;

/** 6軸評価の軸名 */
export type EvaluationAxisKey =
  | "workVolume"       // 稼働量
  | "discipline"       // 規律
  | "results"          // 成果
  | "absorption"       // 吸収力
  | "orgContribution"  // 組織貢献
  | "thinking";        // 思考力

/** 各軸のメタ情報 */
export interface EvaluationAxisMeta {
  key: EvaluationAxisKey;
  label: string;       // 日本語ラベル
  description: string; // 評価観点の説明
  color: string;       // レーダーチャート用カラー
}

/** 6軸評価軸の定義 */
export const EVALUATION_AXES: EvaluationAxisMeta[] = [
  {
    key: "workVolume",
    label: "稼働量",
    description: "出勤日数・コール数・稼働時間など、物理的な活動量",
    color: "#6366f1",
  },
  {
    key: "discipline",
    label: "規律",
    description: "時間厳守・ルール遵守・報連相の徹底度",
    color: "#22c55e",
  },
  {
    key: "results",
    label: "成果",
    description: "アポ獲得数・目標達成率などの定量的な成果",
    color: "#f59e0b",
  },
  {
    key: "absorption",
    label: "吸収力",
    description: "研修内容・フィードバックの理解速度と実践への転用度",
    color: "#ec4899",
  },
  {
    key: "orgContribution",
    label: "組織貢献",
    description: "チームへの支援・ナレッジ共有・職場の雰囲気への貢献",
    color: "#14b8a6",
  },
  {
    key: "thinking",
    label: "思考力",
    description: "課題の本質把握・改善策の立案・論理的な言語化能力",
    color: "#f97316",
  },
];

/** 1軸分のスコア（本人評価 + AM評価） */
export interface AxisScore {
  selfScore: Score | null;   // 本人評価
  amScore: Score | null;     // AM評価
  selfComment?: string;      // 本人コメント
  amComment?: string;        // AMコメント
}

/** 6軸全体の評価スコアマップ */
export type EvaluationScores = {
  [K in EvaluationAxisKey]: AxisScore;
};

/** 評価期間 */
export interface EvaluationPeriod {
  year: number;
  month: number; // 1〜12
}

/** 1回分の評価レコード */
export interface EvaluationRecord {
  id: string;
  period: EvaluationPeriod;
  scores: EvaluationScores;
  overallSelfScore?: number;   // 本人評価の総合スコア (自動計算)
  overallAmScore?: number;     // AM評価の総合スコア (自動計算)
  selfSubmittedAt?: string;    // 本人評価提出日時 (ISO 8601)
  amSubmittedAt?: string;      // AM評価提出日時 (ISO 8601)
  createdAt: string;
  updatedAt: string;
}

/** 離脱リスクレベル */
export type ChurnRiskLevel = "low" | "medium" | "high" | "critical";

/** アポインターのステータス */
export type AppointersStatus = "active" | "inactive" | "on_leave" | "resigned";

/** アポインター (スタッフ) */
export interface Appointer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  joinedAt: string;           // 入社日 (ISO 8601)
  status: AppointersStatus;
  amId: string;               // 担当AMのID
  teamId?: string;
  evaluations: EvaluationRecord[];
  churnRisk: ChurnRiskLevel;
  churnRiskScore: number;     // 0〜100
  churnRiskFactors: string[]; // リスク要因のリスト
  notes?: string;             // AMメモ
  avatarUrl?: string;
}

/** AM (エリアマネージャー / アカウントマネージャー) */
export interface AM {
  id: string;
  name: string;
  email: string;
  teamName: string;
  appointers: string[]; // 担当アポインターのIDリスト
}

/** チーム */
export interface Team {
  id: string;
  name: string;
  amId: string;
  appointerIds: string[];
}

// ─── ユーティリティ型 ───────────────────────────────────────────

/** 空のEvaluationScoresを生成するヘルパー */
export function createEmptyScores(): EvaluationScores {
  return {
    workVolume:      { selfScore: null, amScore: null },
    discipline:      { selfScore: null, amScore: null },
    results:         { selfScore: null, amScore: null },
    absorption:      { selfScore: null, amScore: null },
    orgContribution: { selfScore: null, amScore: null },
    thinking:        { selfScore: null, amScore: null },
  };
}

/** スコアの平均を計算 */
export function calcAverageScore(
  scores: EvaluationScores,
  type: "self" | "am"
): number | null {
  const key = type === "self" ? "selfScore" : "amScore";
  const values = EVALUATION_AXES.map((ax) => scores[ax.key][key]).filter(
    (v): v is Score => v !== null
  );
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** レーダーチャート用データへ変換 */
export function toRadarData(scores: EvaluationScores) {
  return EVALUATION_AXES.map((ax) => ({
    axis: ax.label,
    self: scores[ax.key].selfScore ?? 0,
    am: scores[ax.key].amScore ?? 0,
    fullMark: 5,
  }));
}

/** 離脱リスクレベルの表示設定 */
export const CHURN_RISK_CONFIG: Record<
  ChurnRiskLevel,
  { label: string; color: string; bgColor: string }
> = {
  low:      { label: "低リスク",   color: "text-green-700",  bgColor: "bg-green-100"  },
  medium:   { label: "中リスク",   color: "text-yellow-700", bgColor: "bg-yellow-100" },
  high:     { label: "高リスク",   color: "text-orange-700", bgColor: "bg-orange-100" },
  critical: { label: "要対応",     color: "text-red-700",    bgColor: "bg-red-100"    },
};

/** ステータスの表示設定 */
export const STATUS_CONFIG: Record<
  AppointersStatus,
  { label: string; color: string; bgColor: string }
> = {
  active:   { label: "稼働中",   color: "text-green-700",  bgColor: "bg-green-100"  },
  inactive: { label: "非稼働",   color: "text-gray-700",   bgColor: "bg-gray-100"   },
  on_leave: { label: "休暇中",   color: "text-blue-700",   bgColor: "bg-blue-100"   },
  resigned: { label: "退職済",   color: "text-red-700",    bgColor: "bg-red-100"    },
};
