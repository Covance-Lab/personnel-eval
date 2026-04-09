export type Role = "Admin" | "AM" | "Bridge" | "Closer" | "Appointer";
export type TeamGroup = "辻利" | "LUMIA";

export interface UserAccount {
  id: string;
  role: Role;
  defaultTeam?: TeamGroup;
}

export interface UserSetup {
  completed: true;
  name: string;
  nickname: string;
  team: TeamGroup;
  /**
   * アポインターの「教育係」閲覧制御に利用する。
   * どのユーザーを教育係として選んだかをIDで保持する。
   */
  educationMentorUserId: string;
}

export type Gender = "男性" | "女性" | "その他" | "未回答";

export interface UserProfileDetails {
  age?: number;
  gender?: Gender;
  hobbies?: string;
  selfIntroduction?: string;
  photos?: {
    iconPhotoDataUrl?: string;
    featuredPhotoDataUrls?: [string | undefined, string | undefined];
  };
}

