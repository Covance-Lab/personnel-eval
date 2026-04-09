export function formatRemainingTime(deadlineAtIso: string, now = new Date()): {
  isOverdue: boolean;
  label: string;
} {
  const deadline = new Date(deadlineAtIso);
  const diffMs = deadline.getTime() - now.getTime();
  if (!Number.isFinite(diffMs)) {
    return { isOverdue: false, label: "期限不明" };
  }
  if (diffMs <= 0) return { isOverdue: true, label: "期限超過" };

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);

  if (days >= 1) {
    return { isOverdue: false, label: `あと ${days}日 ${hours}時間` };
  }
  if (hours >= 1) {
    return { isOverdue: false, label: `あと ${hours}時間 ${minutes}分` };
  }
  return { isOverdue: false, label: `あと ${minutes}分` };
}

export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  // value: "YYYY-MM-DDTHH:mm" (ローカル時間)
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

