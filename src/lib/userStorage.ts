import type { UserProfileDetails, UserSetup, TeamGroup, Role } from "@/types/user";

const STORAGE_PREFIX = "pe_user_";

const KEY_CURRENT_USER_ID = `${STORAGE_PREFIX}currentUserId`;
const KEY_SETUP_BY_USER_ID = `${STORAGE_PREFIX}setupByUserId`;
const KEY_PROFILES_BY_USER_ID = `${STORAGE_PREFIX}profilesByUserId`;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function safeReadJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getCurrentUserId(): string | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(KEY_CURRENT_USER_ID);
  return raw ? raw : null;
}

export function setCurrentUserId(userId: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY_CURRENT_USER_ID, userId);
}

export function clearCurrentUserId(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_CURRENT_USER_ID);
}

export function loadSetupByUserId(): Record<string, UserSetup> {
  return safeReadJson<Record<string, UserSetup>>(KEY_SETUP_BY_USER_ID, {});
}

export function getSetupForUserId(userId: string): UserSetup | null {
  const map = loadSetupByUserId();
  return map[userId] ?? null;
}

export function saveSetupForUserId(userId: string, setup: Omit<UserSetup, "completed">): void {
  const map = loadSetupByUserId();
  map[userId] = { completed: true, ...setup };
  safeWriteJson(KEY_SETUP_BY_USER_ID, map);
}

export function loadProfilesByUserId(): Record<string, UserProfileDetails> {
  return safeReadJson<Record<string, UserProfileDetails>>(KEY_PROFILES_BY_USER_ID, {});
}

export function getProfileDetailsForUserId(userId: string): UserProfileDetails | null {
  const map = loadProfilesByUserId();
  return map[userId] ?? null;
}

export function saveProfileDetailsForUserId(userId: string, details: UserProfileDetails): void {
  const map = loadProfilesByUserId();
  map[userId] = details;
  safeWriteJson(KEY_PROFILES_BY_USER_ID, map);
}

export function resetAllPrototypeData(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_CURRENT_USER_ID);
  window.localStorage.removeItem(KEY_SETUP_BY_USER_ID);
  window.localStorage.removeItem(KEY_PROFILES_BY_USER_ID);
}

export type { TeamGroup, Role, UserProfileDetails, UserSetup };

