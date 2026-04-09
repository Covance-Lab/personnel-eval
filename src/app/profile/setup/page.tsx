"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Gender } from "@/types/user";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("未回答");
  const [hobbies, setHobbies] = useState("");
  const [selfIntroduction, setSelfIntroduction] = useState("");
  const [iconImageUrl, setIconImageUrl] = useState("");
  const [featuredImage1Url, setFeaturedImage1Url] = useState("");
  const [featuredImage2Url, setFeaturedImage2Url] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    // setupCompleted が false のまま来た場合は /setup へ戻す
    // ただし /setup → /profile/setup の遷移直後はセッション更新が遅れる場合があるため
    // 少し待ってから確認する（update() が完了するまでの猶予）
  }, [status, session, router]);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: age.trim() ? Number(age) : null,
          gender,
          hobbies: hobbies.trim() || null,
          self_introduction: selfIntroduction.trim() || null,
          icon_image_url: iconImageUrl || null,
          featured_image_1_url: featuredImage1Url || null,
          featured_image_2_url: featuredImage2Url || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "プロフィールの保存に失敗しました");
      }
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6">
        <div className="space-y-2">
          <h1 className="text-xl font-bold">プロフィール入力</h1>
          <p className="text-sm text-gray-600">
            初期設定の次に、プロフィール情報を入力してください。
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">アイコン画像（アップロード）</p>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setIconImageUrl(await fileToDataUrl(file));
              }}
            />
            {iconImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconImageUrl} alt="icon preview" className="mt-2 w-20 h-20 rounded-full object-cover border" />
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">名前（あだ名）</p>
            <Input value={session?.user?.nickname ?? ""} disabled />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">年齢</p>
            <Input
              type="number"
              min={0}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="例: 24"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">性別</p>
            <Select value={gender} onValueChange={(v) => setGender((v ?? "未回答") as Gender)}>
              <SelectTrigger>
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="男性">男性</SelectItem>
                <SelectItem value="女性">女性</SelectItem>
                <SelectItem value="その他">その他</SelectItem>
                <SelectItem value="未回答">未回答</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">趣味</p>
            <Input
              value={hobbies}
              onChange={(e) => setHobbies(e.target.value)}
              placeholder="例: 旅行、映画、カフェ巡り"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">自己紹介</p>
            <textarea
              className="w-full min-h-[110px] rounded-lg border bg-white p-2 text-sm"
              value={selfIntroduction}
              onChange={(e) => setSelfIntroduction(e.target.value)}
              placeholder="例: 明るく前向きに行動するのが得意です。"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">イチオシ写真1（アップロード）</p>
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setFeaturedImage1Url(await fileToDataUrl(file));
                }}
              />
              {featuredImage1Url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featuredImage1Url} alt="featured1 preview" className="mt-2 w-full h-32 rounded object-cover border" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">イチオシ写真2（アップロード）</p>
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setFeaturedImage2Url(await fileToDataUrl(file));
                }}
              />
              {featuredImage2Url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featuredImage2Url} alt="featured2 preview" className="mt-2 w-full h-32 rounded object-cover border" />
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "保存中..." : "プロフィールを保存してダッシュボードへ"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

