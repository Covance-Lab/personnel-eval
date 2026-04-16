export type RoadmapStepId =
  | "instaThreadsAccount"
  | "followers400500"
  | "reelsPost"
  | "min9Posts"
  | "productUnderstanding"
  | "listSelectionDmUnderstanding";

export const ROADMAP_STEPS: Array<{ id: RoadmapStepId; label: string; short: string }> = [
  { id: "instaThreadsAccount", label: "インスタ・Threadsアカウント作成", short: "アカウント作成" },
  { id: "followers400500", label: "フォロワー400-500人達成", short: "フォロワー達成" },
  { id: "reelsPost", label: "リール投稿作成", short: "リール投稿" },
  { id: "min9Posts", label: "最低9投稿完了", short: "最低9投稿" },
  { id: "productUnderstanding", label: "商材理解", short: "商材理解" },
  { id: "listSelectionDmUnderstanding", label: "リスト選定・DM送信理解", short: "リスト/DM理解" },
];

export const ROADMAP_STEP_WEIGHT = 100 / 6; // 1ステップ=約16.6%

export interface AppointerRoadmap {
  userId: string; // appointer user id
  registeredAt: string; // ISO
  /**
   * 完了ステップ数（0〜6）
   * 例: completedStepCount=0 => ステップ1未完了（開始状態）
   *     completedStepCount=4 => ステップ1〜4完了、ステップ5が次
   */
  completedStepCount: number;
  /**
   * 各ステップの完了期限（ISO文字列）。未設定は未存在。
   * AMは「次のステップ」に対して設定する想定。
   */
  deadlinesByStepId: Partial<Record<RoadmapStepId, string>>;
  /**
   * AMが残す自由記述メモ（アポインター別）
   */
  amMemo: string;
  /**
   * 営業マンが残す自由記述メモ（アポインター別）
   * 同チームの営業マン・管理者のみ閲覧可（アポインター・他チームは見えない）
   */
  salesMemo?: string;
}

