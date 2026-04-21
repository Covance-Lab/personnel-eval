"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, User, Sparkles, FileText, Image as ImageIcon, Receipt, ChevronRight } from "lucide-react";
import type { Gender } from "@/types/user";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "rgba(207,163,64,0.15)", color: "#cfa340" }}>
        {icon}
      </span>
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <div className="flex-1 h-px bg-amber-100 ml-1" />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 mb-1.5 tracking-wide uppercase">{children}</p>;
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
  const [invoiceRegistration, setInvoiceRegistration] = useState<"登録済み" | "未登録">("未登録");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated") {
      fetch("/api/user/me")
        .then((r) => r.json())
        .then(({ user }) => {
          if (user?.invoice_registration) setInvoiceRegistration(user.invoice_registration as "登録済み" | "未登録");
        })
        .catch(() => {});
    }
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
          invoice_registration: invoiceRegistration,
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fff9ec" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#cfa340", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #fff9ec 0%, #fef5de 100%)" }}>
      {/* ゴールドアクセントバー */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #cfa340, #e8c060, #cfa340)" }} />

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── ページヘッダー ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full" style={{ background: "#cfa340" }} />
            <h1 className="text-xl font-bold text-gray-900">プロフィール設定</h1>
          </div>
          <p className="text-sm text-amber-800/50 ml-3.5">メンバー情報を入力してください</p>
        </div>

        <div className="space-y-4">

          {/* ── アイコン画像 ── */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100 p-5 shadow-sm">
            <SectionHeader icon={<Camera className="w-4 h-4" />} label="アイコン画像" />
            <div className="flex items-center gap-5">
              {/* プレビュー */}
              <div className="w-20 h-20 rounded-full border-2 border-amber-200 overflow-hidden shrink-0 flex items-center justify-center"
                style={{ background: iconImageUrl ? undefined : "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
                {iconImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconImageUrl} alt="icon preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-amber-400" />
                )}
              </div>
              {/* アップロードボタン */}
              <div className="flex-1">
                <label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 border-dashed border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-colors text-sm font-medium text-amber-700">
                  <Camera className="w-4 h-4" />
                  画像を選択
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIconImageUrl(await fileToDataUrl(file));
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-1.5">JPG / PNG / GIF 推奨</p>
              </div>
            </div>
          </div>

          {/* ── 基本情報 ── */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100 p-5 shadow-sm space-y-4">
            <SectionHeader icon={<User className="w-4 h-4" />} label="基本情報" />

            {/* 名前（固定） */}
            <div>
              <FieldLabel>名前（あだ名）</FieldLabel>
              <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-sm font-medium text-gray-700">
                {session?.user?.nickname ?? "—"}
              </div>
            </div>

            {/* 年齢・性別 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>年齢</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="例: 24"
                  className="w-full px-3 py-2.5 rounded-xl border border-amber-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                />
              </div>
              <div>
                <FieldLabel>性別</FieldLabel>
                <Select value={gender} onValueChange={(v) => setGender((v ?? "未回答") as Gender)}>
                  <SelectTrigger className="rounded-xl border-amber-100 bg-white focus:ring-amber-300">
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
            </div>

            {/* 趣味 */}
            <div>
              <FieldLabel>趣味・関心</FieldLabel>
              <input
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
                placeholder="例: 旅行、映画、カフェ巡り"
                className="w-full px-3 py-2.5 rounded-xl border border-amber-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
              />
            </div>
          </div>

          {/* ── 自己紹介 ── */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100 p-5 shadow-sm">
            <SectionHeader icon={<FileText className="w-4 h-4" />} label="自己紹介" />
            <textarea
              className="w-full min-h-[110px] rounded-xl border border-amber-100 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition resize-none"
              value={selfIntroduction}
              onChange={(e) => setSelfIntroduction(e.target.value)}
              placeholder="例: 明るく前向きに行動するのが得意です。よろしくお願いします！"
            />
          </div>

          {/* ── イチオシ写真 ── */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100 p-5 shadow-sm">
            <SectionHeader icon={<ImageIcon className="w-4 h-4" />} label="イチオシ写真" />
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: "写真1", url: featuredImage1Url, setUrl: setFeaturedImage1Url },
                { label: "写真2", url: featuredImage2Url, setUrl: setFeaturedImage2Url },
              ] as const).map(({ label, url, setUrl }) => (
                <div key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <label className="block cursor-pointer">
                    <div className={`w-full h-28 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-colors ${
                      url ? "border-amber-200" : "border-amber-200 hover:border-amber-400 hover:bg-amber-50"
                    }`}>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center text-amber-400">
                          <ImageIcon className="w-6 h-6 mx-auto mb-1" />
                          <p className="text-xs">タップして選択</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUrl(await fileToDataUrl(file));
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* ── インボイス登録 ── */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100 p-5 shadow-sm">
            <SectionHeader icon={<Receipt className="w-4 h-4" />} label="インボイス登録" />
            <Select
              value={invoiceRegistration}
              onValueChange={(v) => setInvoiceRegistration(v as "登録済み" | "未登録")}
            >
              <SelectTrigger className="rounded-xl border-amber-100 bg-white focus:ring-amber-300">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="登録済み">登録済み</SelectItem>
                <SelectItem value="未登録">未登録</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* エラー */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 保存ボタン */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-[54px] rounded-2xl text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 shadow-lg"
            style={{
              background: saving
                ? "#b8902e"
                : "linear-gradient(135deg, #cfa340 0%, #e8c060 50%, #cfa340 100%)",
              boxShadow: "0 8px 24px rgba(207,163,64,0.35)",
            }}
          >
            {saving ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                保存中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                プロフィールを保存してはじめる
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}
