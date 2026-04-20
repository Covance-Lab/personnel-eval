export type RoadmapStepId =
  | "step1" | "step2" | "step3" | "step4"
  | "step5" | "step6" | "step7"
  | "step8" | "step9" | "step10" | "step11" | "step12"
  | "step13" | "step14" | "step15" | "step16" | "step17";

export interface RoadmapStepDef {
  id: RoadmapStepId;
  label: string;
  short: string;
  phaseId: string;
}

export interface RoadmapPhaseDef {
  id: string;
  label: string;
  steps: RoadmapStepDef[];
}

export const ROADMAP_PHASES: RoadmapPhaseDef[] = [
  {
    id: "phase1",
    label: "Phase 1: 基礎構築",
    steps: [
      { id: "step1", label: "担当の営業マンorAMと初回ミーティング", short: "初回ミーティング", phaseId: "phase1" },
      { id: "step2", label: "InstagramとThreadsのアカウント作成",    short: "アカウント作成",   phaseId: "phase1" },
      { id: "step3", label: "フォロワー増加用のプロフィールを設定",   short: "プロフィール設定", phaseId: "phase1" },
      { id: "step4", label: "フォロワー増加のためのフォロー作業",     short: "フォロー作業",     phaseId: "phase1" },
    ],
  },
  {
    id: "phase2",
    label: "Phase 2: アカウント成長",
    steps: [
      { id: "step5", label: "【目標】フォロワー150人達成", short: "FF150人",  phaseId: "phase2" },
      { id: "step6", label: "【目標】フォロワー300人達成", short: "FF300人",  phaseId: "phase2" },
      { id: "step7", label: "【目標】フォロワー350人達成", short: "FF350人",  phaseId: "phase2" },
    ],
  },
  {
    id: "phase3",
    label: "Phase 3: コンテンツ運用",
    steps: [
      { id: "step8",  label: "アカウントを転生させるための投稿準備", short: "投稿準備",      phaseId: "phase3" },
      { id: "step9",  label: "1投稿目 完了（再スタート！）",          short: "1投稿目",       phaseId: "phase3" },
      { id: "step10", label: "3投稿目 完了",                          short: "3投稿目",       phaseId: "phase3" },
      { id: "step11", label: "6投稿目 完了",                          short: "6投稿目",       phaseId: "phase3" },
      { id: "step12", label: "9投稿目 完了",                          short: "9投稿目",       phaseId: "phase3" },
    ],
  },
  {
    id: "phase4",
    label: "Phase 4: 実践・自走",
    steps: [
      { id: "step13", label: "COTONARIのサービス理解",           short: "サービス理解",   phaseId: "phase4" },
      { id: "step14", label: "アポ取り方法の理解（トーク構築）", short: "トーク構築",     phaseId: "phase4" },
      { id: "step15", label: "DM送信（ファーストアプローチ）",   short: "DM送信",         phaseId: "phase4" },
      { id: "step16", label: "【習慣】DM 1日25通達成",           short: "DM25通/日",      phaseId: "phase4" },
      { id: "step17", label: "KPIの理解（自走開始！）",          short: "KPI理解・自走",  phaseId: "phase4" },
    ],
  },
];

/** フラットなステップ一覧（順番はフェーズ順） */
export const ROADMAP_STEPS: RoadmapStepDef[] = ROADMAP_PHASES.flatMap((p) => p.steps);

export const ROADMAP_STEP_WEIGHT = 100 / ROADMAP_STEPS.length;

export interface AppointerRoadmap {
  userId: string; // appointer user id
  registeredAt: string; // ISO
  /**
   * 完了ステップ数（0〜17）
   * completedStepCount=3 => step1〜step3完了、step4が現在のステップ
   */
  completedStepCount: number;
  /**
   * 各ステップの完了期限（ISO文字列）。未設定は未存在。
   */
  deadlinesByStepId: Partial<Record<RoadmapStepId, string>>;
  /**
   * AMが残す自由記述メモ（アポインター別）
   */
  amMemo: string;
  /**
   * 営業マンが残す自由記述メモ（アポインター別）
   */
  salesMemo?: string;
}
