"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Menu, X, BarChart2, Users, Settings, User, LogOut,
  TrendingUp, ChevronRight, UserCircle, RefreshCw,
} from "lucide-react";
import type { Role } from "@/types/user";
import { useViewAs } from "@/contexts/ViewAsContext";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

function getNavItems(role: Role, currentPath: string, router: ReturnType<typeof useRouter>): NavItem[] {
  const go = (href: string) => () => router.push(href);
  const isActive = (href: string) => currentPath === href || currentPath.startsWith(href + "/");

  switch (role) {
    case "Admin":
      return [
        { label: "全体実績",       href: "/overview",      icon: <BarChart2 className="w-5 h-5" />,   onClick: go("/overview"),        active: isActive("/overview") },
        { label: "人事評価",       href: "/hr",             icon: <Users className="w-5 h-5" />,       onClick: go("/hr"),              active: isActive("/hr") },
        { label: "Admin設定",     href: "/admin",          icon: <Settings className="w-5 h-5" />,    onClick: go("/admin"),           active: isActive("/admin") },
        { label: "プロフィール設定", href: "/profile/setup", icon: <User className="w-5 h-5" />,       onClick: go("/profile/setup"),   active: isActive("/profile/setup") },
      ];
    case "Sales":
      return [
        { label: "チーム実績",      href: "/sales",         icon: <TrendingUp className="w-5 h-5" />,  onClick: go("/sales"),          active: isActive("/sales") },
        { label: "アポインター管理", href: "/hr",             icon: <Users className="w-5 h-5" />,       onClick: go("/hr"),             active: isActive("/hr") },
        { label: "プロフィール設定", href: "/profile/setup", icon: <User className="w-5 h-5" />,       onClick: go("/profile/setup"),  active: isActive("/profile/setup") },
      ];
    case "AM":
      return [
        { label: "数値管理",        href: "/am",             icon: <BarChart2 className="w-5 h-5" />,   onClick: go("/am"),              active: currentPath === "/am" },
        { label: "アポインター管理", href: "/am/appointers",  icon: <Users className="w-5 h-5" />,       onClick: go("/am/appointers"),   active: isActive("/am/appointers") },
        { label: "プロフィール設定", href: "/profile/setup",  icon: <User className="w-5 h-5" />,       onClick: go("/profile/setup"),   active: isActive("/profile/setup") },
      ];
    case "AM_Sales":
      return [
        { label: "数値管理",              href: "/am-sales",                          icon: <BarChart2 className="w-5 h-5" />,   onClick: go("/am-sales"),                                          active: currentPath === "/am-sales" },
        { label: "自分管轄のアポインター", href: "/am-sales/appointers?view=own",     icon: <Users className="w-5 h-5" />,       onClick: go("/am-sales/appointers?view=own"),    active: isActive("/am-sales/appointers") && !currentPath.includes("view=others") },
        { label: "他AM管轄のアポインター", href: "/am-sales/appointers?view=others",  icon: <TrendingUp className="w-5 h-5" />,  onClick: go("/am-sales/appointers?view=others"), active: currentPath.includes("view=others") },
        { label: "人事評価",              href: "/hr",                                icon: <ChevronRight className="w-5 h-5" />, onClick: go("/hr"),                              active: isActive("/hr") },
        { label: "プロフィール設定",       href: "/profile/setup",                    icon: <User className="w-5 h-5" />,        onClick: go("/profile/setup"),                   active: isActive("/profile/setup") },
      ];
    case "Appointer":
      return [
        { label: "現状の数字",        href: "/appointer",          icon: <BarChart2 className="w-5 h-5" />,   onClick: go("/appointer"),          active: isActive("/appointer") },
        { label: "実績管理",          href: "/appointer/history",  icon: <TrendingUp className="w-5 h-5" />,  onClick: go("/appointer/history"),  active: isActive("/appointer/history") },
        { label: "プロフィール設定",   href: "/profile/setup",      icon: <User className="w-5 h-5" />,       onClick: go("/profile/setup"),      active: isActive("/profile/setup") },
        { label: "担当者のプロフィール", href: "/appointer/mentors", icon: <UserCircle className="w-5 h-5" />, onClick: go("/appointer/mentors"),  active: isActive("/appointer/mentors") },
      ];
    default:
      return [
        { label: "プロフィール設定", href: "/profile/setup", icon: <User className="w-5 h-5" />, onClick: go("/profile/setup"), active: false },
      ];
  }
}

const TEAMS = ["辻利", "LUMIA"] as const;

interface NavMenuProps {
  role: Role;
  userName: string;
  userImage?: string | null;
  userTeam?: string;
}

export default function NavMenu({ role, userName, userImage, userTeam }: NavMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { viewAs, setViewAs, clearViewAs } = useViewAs();

  const effectiveRole = (role === "Admin" && viewAs.role === "Sales") ? "Sales" : role;
  const items = getNavItems(effectiveRole as Role, pathname, router);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setShowTeamPicker(false); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const roleLabel: Record<string, string> = {
    Admin: "管理者", Sales: "営業マン", AM: "アポインターマネージャー",
    Appointer: "アポインター", Bridge: "ブリッジ", Closer: "クローザー",
  };

  // 権限バッジ色（テーマに合わせたカラーパレット）
  const roleBadgeStyle: Record<string, { bg: string; text: string }> = {
    Admin:     { bg: "#ede9fe", text: "#5b21b6" },
    Sales:     { bg: "#d1fae5", text: "#065f46" },
    AM:        { bg: "#ccfbf1", text: "#0f766e" },
    Appointer: { bg: "#fef3c7", text: "#92400e" },
    Bridge:    { bg: "#e0f2fe", text: "#0369a1" },
    Closer:    { bg: "#ffe4e6", text: "#9f1239" },
  };
  const badge = roleBadgeStyle[role] ?? { bg: "#f3f4f6", text: "#374151" };

  const displayRoleLabel = viewAs.role === "Sales"
    ? `営業マン（${viewAs.team}）として表示中`
    : (roleLabel[role] ?? role);

  return (
    <>
      {/* ハンバーガーボタン */}
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-xl hover:bg-amber-50 transition-colors"
        aria-label="メニューを開く"
      >
        <Menu className="w-6 h-6 text-gray-600" />
      </button>

      {/* オーバーレイ */}
      {open && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => setOpen(false)} />
      )}

      {/* ドロワー */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-72 z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ background: "#fff9ec" }}
      >
        {/* ── ゴールドアクセントバー ── */}
        <div className="h-1 w-full shrink-0" style={{ background: "linear-gradient(90deg, #cfa340, #e8c060, #cfa340)" }} />

        {/* ── ドロワーヘッダー ── */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-amber-100" style={{ background: "#fdf4e0" }}>
          <div className="flex items-center gap-3">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt={userName} className="w-11 h-11 rounded-full object-cover ring-2 ring-amber-200 ring-offset-1" />
            ) : (
              <div className="w-11 h-11 rounded-full flex items-center justify-center ring-2 ring-amber-200 ring-offset-1"
                style={{ background: "linear-gradient(135deg, #cfa340, #e8c060)" }}>
                <span className="text-sm font-bold text-white">{userName.charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{userName}</p>
              <span
                className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                style={{ background: badge.bg, color: badge.text }}
              >
                {displayRoleLabel}{!viewAs.role && userTeam ? ` · ${userTeam}` : ""}
              </span>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* ── メニュー項目 ── */}
        <nav className="flex-1 overflow-y-auto py-3">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); setShowTeamPicker(false); item.onClick?.(); }}
              className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
                item.active
                  ? "font-semibold"
                  : "text-gray-600 hover:bg-amber-50"
              }`}
              style={item.active ? { background: "rgba(207,163,64,0.12)", color: "#8a6520" } : {}}
            >
              <span className="flex items-center gap-3">
                <span style={item.active ? { color: "#cfa340" } : { color: "#9ca3af" }}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.label}</span>
              </span>
              <ChevronRight className="w-4 h-4" style={item.active ? { color: "#cfa340" } : { color: "#d1d5db" }} />
            </button>
          ))}
        </nav>

        {/* Admin 専用: 営業マン画面切り替え */}
        {role === "Admin" && (
          <div className="border-t border-amber-100 px-4 py-3 space-y-2">
            {viewAs.role === "Sales" ? (
              <button
                onClick={() => { clearViewAs(); setOpen(false); router.push("/admin"); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                <RefreshCw className="w-4 h-4" />
                管理者画面に戻る
              </button>
            ) : (
              <>
                {!showTeamPicker ? (
                  <button
                    onClick={() => setShowTeamPicker(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    style={{ background: "#e0f2fe", color: "#0369a1" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    営業マン画面で見る
                  </button>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 px-1">チームを選択</p>
                    {TEAMS.map((team) => (
                      <button
                        key={team}
                        onClick={() => { setViewAs("Sales", team); setShowTeamPicker(false); setOpen(false); router.push("/sales"); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors"
                        style={{ background: "#e0f2fe", color: "#0369a1" }}
                      >
                        <span>{team}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ))}
                    <button
                      onClick={() => setShowTeamPicker(false)}
                      className="w-full text-xs text-gray-400 py-1 hover:text-gray-600"
                    >
                      キャンセル
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ログアウト */}
        <div className="border-t border-amber-100 p-3" style={{ background: "#fdf4e0" }}>
          <button
            onClick={() => { setOpen(false); clearViewAs(); signOut({ callbackUrl: "/login" }); }}
            className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">ログアウト</span>
          </button>
        </div>
      </div>
    </>
  );
}
