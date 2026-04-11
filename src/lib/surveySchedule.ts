/**
 * アンケートスケジュール管理
 * 毎月1日に配信、5日23:59が締切、4日からリマインド
 */

export interface SurveyWindow {
  year: number;
  month: number;
  monthKey: string;
  deadline: Date;
  daysLeft: number;
}

export function getSurveyWindow(now: Date = new Date()): SurveyWindow {
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const deadline = new Date(year, now.getMonth(), 5, 23, 59, 59, 999);
  const msLeft   = deadline.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

  return { year, month, monthKey, deadline, daysLeft };
}
