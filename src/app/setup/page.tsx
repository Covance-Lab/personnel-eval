"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TeamGroup } from "@/types/user";
import { TEAMS, EDUCATION_MENTORS_BY_TEAM } from "@/data/mockUsers";

// 教育係をAPIから取得する想定（現在はmockUsersから）
function getEducationMentorOptions(team: TeamGroup) {
  return EDUCATION_MENTORS_BY_TEAM[team] ?? [];
}

export default function SetupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [name, setName]   = useState("");
  const [nickname, setNickname] = useState("");
  const [team, setTeam]   = useState<TeamGroup>(TEAMS[0]);
  const [educationMentorUserId, setEducationMentorUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState<string | null>(null);

  const educationMentors = useMemo(() => getEducationMentorOptions(team), [team]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && session.user.setupCompleted) {
      router.replace("/dashboard");
      return;
    }
    // LINEの名前を初期値にセット
    if (status === "authenticated" && session.user.name) {
      setName(session.user.name);
      setNickname(session.user.name);
    }
    // チームが既に設定されていれば反映
    if (status === "authenticated" && session.user.team) {
      setTeam(session.user.team);
    }
    // 教育係の初期値
    const firstMentor = getEducationMentorOptions(team)[0]?.userId ?? "";
    if (!educationMentorUserId && firstMentor) {
      setEducationMentorUserId(firstMentor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, router]);

  useEffect(() => {
    const firstMentor = getEducationMentorOptions(team)[0]?.userId ?? "";
    if (firstMentor) setEducationMentorUserId(firstMentor);
  }, [team]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p>読み込み中...</p>
      </div>
    );
  }

  const canSubmit =
    name.trim().length > 0 &&
    nickname.trim().length > 0 &&
    Boolean(team) &&
    Boolean(educationMentorUserId);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nickname: nickname.trim(),
          team,
          education_mentor_user_id: educationMentorUserId,
          setup_completed: true,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "保存に失敗しました");
      }
      // セッションを更新してから dashboard へ
      router.replace("/dashboard");
      // next-auth のセッションを再取得させるために少し待つ
      setTimeout(() => router.refresh(), 300);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl p-6">
        <div className="space-y-2">
          <h1 className="text-xl font-bold">初期設定</h1>
          <p className="text-sm text-gray-600">
            初回ログイン時のみ必要です。あなたのプロフィールを設定します。
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">本名</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 山田 花子"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">あだ名（スプレッドシートの名前と合わせてください）</p>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例: はなちゃん"
            />
            <p className="text-xs text-gray-400 mt-1">
              Googleスプレッドシートの名前欄と一致させることで実績データが自動連携されます。
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">チーム</p>
            <Select
              value={team}
              onValueChange={(v) => setTeam(v as TeamGroup)}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">教育係</p>
            <Select
              value={educationMentorUserId}
              onValueChange={(v) => setEducationMentorUserId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {educationMentors.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
          >
            {saving ? "保存中..." : "設定を完了する"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
