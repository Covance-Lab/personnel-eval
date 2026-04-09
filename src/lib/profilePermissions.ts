import type { Role } from "@/types/user";
import { roleLabelMap, mockUsers } from "@/data/mockUsers";

export function getRoleLabel(role: Role): string {
  return roleLabelMap[role] ?? role;
}

// プロトタイプではプロフィール権限は最小実装（本件: dashboard側の表示用）
// 将来的にプロフィール閲覧制御を厳密化する際に拡張します。
export function getAllUsersForPrototype(): typeof mockUsers {
  return mockUsers;
}

