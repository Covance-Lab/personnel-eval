import type { Role, TeamGroup, UserAccount } from "@/types/user";

export const TEAMS: TeamGroup[] = ["辻利", "LUMIA"];

export type EducationMentorOption = { userId: string; label: string };

export const EDUCATION_MENTORS_BY_TEAM: Record<TeamGroup, EducationMentorOption[]> = {
  辻利: [
    { userId: "edu-tsujii-yuriko", label: "ゆりこ" },
    { userId: "edu-tsujii-aimi", label: "あいみ" },
  ],
  LUMIA: [
    { userId: "edu-lumia-yui", label: "ゆい" },
    { userId: "edu-lumia-saoring", label: "さおりん" },
  ],
};

export const TEAM_BRIDGE_ID: Record<TeamGroup, string> = {
  辻利: "bridge-tsujii",
  LUMIA: "bridge-lumia",
};

export const TEAM_CLOSER_ID: Record<TeamGroup, string> = {
  辻利: "closer-tsujii",
  LUMIA: "closer-lumia",
};

const makeAccount = (id: string, role: Role, defaultTeam?: TeamGroup): UserAccount => ({
  id,
  role,
  defaultTeam,
});

/**
 * ログイン(プロトタイプ)用のユーザー一覧。
 * 初期設定ウィザードで name/nickname/team/教育係を更新できる。
 */
export const mockUsers: UserAccount[] = [
  makeAccount("admin-01", "Admin"),

  makeAccount("am-tsujii-01", "AM", "辻利"),
  makeAccount("am-lumia-01", "AM", "LUMIA"),

  makeAccount("edu-tsujii-yuriko", "Bridge", "辻利"),
  makeAccount("edu-tsujii-aimi", "Bridge", "辻利"),
  makeAccount("edu-lumia-yui", "Bridge", "LUMIA"),
  makeAccount("edu-lumia-saoring", "Bridge", "LUMIA"),

  makeAccount(TEAM_BRIDGE_ID["辻利"], "Bridge", "辻利"),
  makeAccount(TEAM_CLOSER_ID["辻利"], "Closer", "辻利"),
  makeAccount(TEAM_BRIDGE_ID["LUMIA"], "Bridge", "LUMIA"),
  makeAccount(TEAM_CLOSER_ID["LUMIA"], "Closer", "LUMIA"),

  makeAccount("ap-tsujii-01", "Appointer", "辻利"),
  makeAccount("ap-tsujii-02", "Appointer", "辻利"),
  makeAccount("ap-lumia-01", "Appointer", "LUMIA"),
  makeAccount("ap-lumia-02", "Appointer", "LUMIA"),
];

export const roleLabelMap: Record<Role, string> = {
  Admin: "管理者",
  AM: "アポインターマネージャー",
  Sales: "営業マン",
  Bridge: "ブリッジ",
  Closer: "クローザー",
  Appointer: "アポインター",
};

export function getEducationMentorOptions(team: TeamGroup): EducationMentorOption[] {
  return EDUCATION_MENTORS_BY_TEAM[team];
}

export function getBridgeUserId(team: TeamGroup): string {
  return TEAM_BRIDGE_ID[team];
}

export function getCloserUserId(team: TeamGroup): string {
  return TEAM_CLOSER_ID[team];
}

export function getUserAccountById(userId: string): UserAccount | undefined {
  return mockUsers.find((u) => u.id === userId);
}

