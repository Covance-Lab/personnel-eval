import type {
  AM,
  Appointer,
  EvaluationRecord,
  Team,
} from "@/types/evaluation";

// ─── AM データ ────────────────────────────────────────────────────

export const mockAMs: AM[] = [
  {
    id: "am-001",
    name: "田中 誠",
    email: "tanaka@example.com",
    teamName: "東京Aチーム",
    appointers: ["ap-001", "ap-002", "ap-003", "ap-004"],
  },
  {
    id: "am-002",
    name: "佐藤 美咲",
    email: "sato@example.com",
    teamName: "東京Bチーム",
    appointers: ["ap-005", "ap-006", "ap-007"],
  },
];

// ─── 評価レコード ─────────────────────────────────────────────────

const makeEval = (
  id: string,
  year: number,
  month: number,
  ws: number,
  ds: number,
  rs: number,
  as: number,
  os: number,
  ts: number,
  wam: number,
  dam: number,
  ram: number,
  aam: number,
  oam: number,
  tam: number
): EvaluationRecord => ({
  id,
  period: { year, month },
  scores: {
    workVolume:      { selfScore: ws as 1|2|3|4|5, amScore: wam as 1|2|3|4|5 },
    discipline:      { selfScore: ds as 1|2|3|4|5, amScore: dam as 1|2|3|4|5 },
    results:         { selfScore: rs as 1|2|3|4|5, amScore: ram as 1|2|3|4|5 },
    absorption:      { selfScore: as as 1|2|3|4|5, amScore: aam as 1|2|3|4|5 },
    orgContribution: { selfScore: os as 1|2|3|4|5, amScore: oam as 1|2|3|4|5 },
    thinking:        { selfScore: ts as 1|2|3|4|5, amScore: tam as 1|2|3|4|5 },
  },
  overallSelfScore: Math.round(((ws+ds+rs+as+os+ts)/6)*10)/10,
  overallAmScore:   Math.round(((wam+dam+ram+aam+oam+tam)/6)*10)/10,
  selfSubmittedAt: new Date(year, month-1, 28).toISOString(),
  amSubmittedAt:   new Date(year, month-1, 30).toISOString(),
  createdAt: new Date(year, month-1, 1).toISOString(),
  updatedAt: new Date(year, month-1, 30).toISOString(),
});

// ─── アポインター データ ──────────────────────────────────────────

export const mockAppointors: Appointer[] = [
  {
    id: "ap-001",
    name: "山田 花子",
    email: "yamada@example.com",
    phone: "090-1111-2222",
    joinedAt: "2024-04-01T00:00:00Z",
    status: "active",
    amId: "am-001",
    teamId: "team-001",
    churnRisk: "low",
    churnRiskScore: 12,
    churnRiskFactors: [],
    notes: "安定したパフォーマンス。リーダー候補として育成中。",
    evaluations: [
      makeEval("ev-001-1", 2025, 1, 4,4,4,4,5,4, 4,4,3,4,4,4),
      makeEval("ev-001-2", 2025, 2, 5,4,4,5,5,4, 4,4,4,4,5,4),
      makeEval("ev-001-3", 2025, 3, 5,5,5,5,5,5, 5,4,4,5,5,5),
    ],
  },
  {
    id: "ap-002",
    name: "鈴木 太郎",
    email: "suzuki@example.com",
    phone: "090-2222-3333",
    joinedAt: "2024-07-01T00:00:00Z",
    status: "active",
    amId: "am-001",
    teamId: "team-001",
    churnRisk: "medium",
    churnRiskScore: 45,
    churnRiskFactors: ["成果スコアの低下傾向", "欠勤が増加"],
    notes: "先月から遅刻が目立つ。面談を予定。",
    evaluations: [
      makeEval("ev-002-1", 2025, 1, 3,3,3,3,3,3, 3,3,3,3,3,3),
      makeEval("ev-002-2", 2025, 2, 3,2,3,3,3,2, 3,2,3,3,3,2),
      makeEval("ev-002-3", 2025, 3, 2,2,2,3,3,2, 2,2,2,3,3,2),
    ],
  },
  {
    id: "ap-003",
    name: "伊藤 さくら",
    email: "ito@example.com",
    phone: "090-3333-4444",
    joinedAt: "2023-10-01T00:00:00Z",
    status: "active",
    amId: "am-001",
    teamId: "team-001",
    churnRisk: "high",
    churnRiskScore: 72,
    churnRiskFactors: ["稼働量が急減", "本人評価とAM評価のギャップ大", "モチベーション低下サイン"],
    notes: "3月から急に欠勤が増えた。離脱防止ミーティングを実施予定。",
    evaluations: [
      makeEval("ev-003-1", 2025, 1, 4,4,4,3,4,3, 3,4,4,4,4,3),
      makeEval("ev-003-2", 2025, 2, 3,3,3,3,3,3, 3,3,3,3,3,3),
      makeEval("ev-003-3", 2025, 3, 2,2,2,2,2,2, 2,3,2,2,2,2),
    ],
  },
  {
    id: "ap-004",
    name: "高橋 健",
    email: "takahashi@example.com",
    phone: "090-4444-5555",
    joinedAt: "2025-01-15T00:00:00Z",
    status: "active",
    amId: "am-001",
    teamId: "team-001",
    churnRisk: "critical",
    churnRiskScore: 88,
    churnRiskFactors: [
      "スコアが全軸で最低値",
      "欠席・遅刻が常態化",
      "連絡が取れない日がある",
      "退職意向の発言あり",
    ],
    notes: "緊急面談実施。退職意向を確認。引き留め施策を検討中。",
    evaluations: [
      makeEval("ev-004-1", 2025, 1, 2,2,2,2,2,2, 2,2,2,2,2,2),
      makeEval("ev-004-2", 2025, 2, 2,1,1,2,2,1, 2,1,1,2,2,1),
      makeEval("ev-004-3", 2025, 3, 1,1,1,1,1,1, 1,1,1,1,1,1),
    ],
  },
  {
    id: "ap-005",
    name: "渡辺 美穂",
    email: "watanabe@example.com",
    phone: "090-5555-6666",
    joinedAt: "2024-03-01T00:00:00Z",
    status: "active",
    amId: "am-002",
    teamId: "team-002",
    churnRisk: "low",
    churnRiskScore: 8,
    churnRiskFactors: [],
    notes: "月間MVPを連続受賞。ロールモデルとして活躍中。",
    evaluations: [
      makeEval("ev-005-1", 2025, 1, 5,5,5,5,5,4, 5,5,5,5,5,4),
      makeEval("ev-005-2", 2025, 2, 5,5,5,5,5,5, 5,5,5,5,5,5),
      makeEval("ev-005-3", 2025, 3, 5,5,5,5,5,5, 5,5,5,5,5,5),
    ],
  },
  {
    id: "ap-006",
    name: "中村 拓也",
    email: "nakamura@example.com",
    phone: "090-6666-7777",
    joinedAt: "2024-09-01T00:00:00Z",
    status: "on_leave",
    amId: "am-002",
    teamId: "team-002",
    churnRisk: "medium",
    churnRiskScore: 38,
    churnRiskFactors: ["休暇中のため稼働量なし"],
    notes: "育休取得中。4月復帰予定。",
    evaluations: [
      makeEval("ev-006-1", 2025, 1, 4,4,4,4,4,3, 4,4,3,4,4,3),
      makeEval("ev-006-2", 2025, 2, 4,4,4,4,4,4, 4,4,4,4,4,4),
    ],
  },
  {
    id: "ap-007",
    name: "小林 奈々",
    email: "kobayashi@example.com",
    phone: "090-7777-8888",
    joinedAt: "2023-06-01T00:00:00Z",
    status: "active",
    amId: "am-002",
    teamId: "team-002",
    churnRisk: "low",
    churnRiskScore: 20,
    churnRiskFactors: [],
    notes: "安定したパフォーマンス。新人の指導役を担当。",
    evaluations: [
      makeEval("ev-007-1", 2025, 1, 4,4,3,4,4,4, 4,4,3,4,4,4),
      makeEval("ev-007-2", 2025, 2, 4,4,4,4,4,4, 4,4,4,4,4,4),
      makeEval("ev-007-3", 2025, 3, 4,5,4,4,5,4, 4,5,4,4,5,4),
    ],
  },
];

// ─── チーム データ ────────────────────────────────────────────────

export const mockTeams: Team[] = [
  {
    id: "team-001",
    name: "東京Aチーム",
    amId: "am-001",
    appointerIds: ["ap-001", "ap-002", "ap-003", "ap-004"],
  },
  {
    id: "team-002",
    name: "東京Bチーム",
    amId: "am-002",
    appointerIds: ["ap-005", "ap-006", "ap-007"],
  },
];

// ─── ヘルパー関数 ─────────────────────────────────────────────────

/** IDでアポインターを取得 */
export function getAppointersById(id: string): Appointer | undefined {
  return mockAppointors.find((a) => a.id === id);
}

/** AMでアポインター一覧を取得 */
export function getAppoinorsByAM(amId: string): Appointer[] {
  return mockAppointors.filter((a) => a.amId === amId);
}

/** 最新の評価レコードを取得 */
export function getLatestEvaluation(appointer: Appointer): EvaluationRecord | null {
  if (appointer.evaluations.length === 0) return null;
  return [...appointer.evaluations].sort((a, b) => {
    if (a.period.year !== b.period.year) return b.period.year - a.period.year;
    return b.period.month - a.period.month;
  })[0];
}

/** リスクレベル別の統計 */
export function getRiskSummary() {
  const all = mockAppointors.filter((a) => a.status !== "resigned");
  return {
    total:    all.length,
    low:      all.filter((a) => a.churnRisk === "low").length,
    medium:   all.filter((a) => a.churnRisk === "medium").length,
    high:     all.filter((a) => a.churnRisk === "high").length,
    critical: all.filter((a) => a.churnRisk === "critical").length,
  };
}
