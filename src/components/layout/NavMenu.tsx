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
        { label: "全体実績",    href: "/overview",        icon: <BarChart2 className="w-5 h-5" />,   onClick: go("/overview"),        active: isActive("/overview") },
        { label: "人事評価",    href: "/hr",              icon: <Users className="w-5 h-5" />,       onClick: go("/hr"),              active: isActive("/hr") },
        { label: "Admin設定",  href: "/admin",           icon: <Settings className="w-5 h-5" />,    onClick: go("/admin"),           active: isActive("/admin") },
        { label: "プロフィール設定", href: "/profile/setup", icon: <User className="w-5 h-5" />,    onClick: go("/profile/setup"),   active: isActive("/profile/setup") },
      ];
    case "Sales":
      return [
        { label: "チーム実績",     href: "/sales",        icon: <TrendingUp className="w-5 h-5" />,  onClick: go("/sales"),         active: isActive("/sales") },
        { label: "アポインター管理", href: "/hr",           icon: <Users className="w-5 h-5" />,       onClick: go("/hr"),            active: isActive("/hr") },
        { label: "プロフィール設定", href: "/profile/setup", icon: <User className="w-5 h-5" />,    onClick: go("/profile/setup"),  active: isActive("/profile/setup") },
      ];
    case "AM":
      return [
        { label: "数値管理",       href: "/am",               icon: <BarChart2 className="w-5 h-5" />,   onClick: go("/am"),               active: currentPath === "/am" },
        { label: "アポインター管理", href: "/am/appointers",   icon: <Users className="w-5 h-5" />,       onClick: go("/am/appointers"),    active: isActive("/am/appointers") },
        { label: "プロフィール設定", href: "/profile/setup",   icon: <User className="w-5 h-5" />,        onClick: go("/profile/setup"),    active: isActive("/profile/setup") },
      ];
    case "Appointer":
      return [
        { label: "現状の数字",  href: "/appointer",       icon: <BarChart2 className="w-5 h-5" />,   onClick: go("/appointer"),       active: isActive("/appointer") },
        { label: "実績管理",    href: "/appointer/history", icon: <TrendingUp className="w-5 h-5" />, onClick: go("/appointer/history"), active: isActive("/appointer/history") },
        { label: "プロフィール設定", href: "/profile/setup", icon: <User className="w-5 h-5" />,    onClick: go("/profile/setup"),   active: isActive("/profile/setup") },
        { label: "担当者のプロフィール", href: "/appointer/mentors", icon: <UserCircle className="w-5 h-5" />, onClick: go("/appointer/mentors"), active: isActive("/appointer/mentors") },
      ];
    default:
      return [
        { label: "プロフィール設定", href: "/profile/setup", icon: <User className="w-5 h-5" />,    onClick: go("/profile/setup"),   active: false },
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

  // 表示上のロール（Adminがビューアズ中はSales扱い）
  const effectiveRole = (role === "Admin" && viewAs.role === "Sales") ? "Sales" : role;
  const items = getNavItems(effectiveRole as Role, pathname, router);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ESCキーで閉じる
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

  const displayRoleLabel = viewAs.role === "Sales"
    ? `営業マン（${viewAs.team}）として表示中`
    : (roleLabel[role] ?? role);

  return (
    <>
      {/* ハンバーガーボタン */}
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="メニューを開く"
      >
        <Menu className="w-6 h-6 text-gray-600" />
      </button>

      {/* オーバーレイ */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={() => setOpen(false)} />
      )}

      {/* ドロワー */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ドロワーヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt={userName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-600">{userName.charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{userName}</p>
              <p className="text-xs text-gray-400">{displayRoleLabel}{!viewAs.role && userTeam ? ` · ${userTeam}` : ""}</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* メニュー項目 */}
        <nav className="flex-1 overflow-y-auto py-3">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); setShowTeamPicker(false); item.onClick?.(); }}
              className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
                item.active
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={item.active ? "text-indigo-600" : "text-gray-400"}>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </span>
              <ChevronRight className={`w-4 h-4 ${item.active ? "text-indigo-400" : "text-gray-300"}`} />
            </button>
          ))}
        </nav>

        {/* Admin 専用: 営業マン画面切り替え */}
        {role === "Admin" && (
          <div className="border-t px-4 py-3 space-y-2">
            {viewAs.role === "Sales" ? (
              <button
                onClick={() => { clearViewAs(); setOpen(false); router.push("/admin"); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                管理者画面に戻る
              </button>
            ) : (
              <>
                {!showTeamPicker ? (
                  <button
                    onClick={() => setShowTeamPicker(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    営業マン画面で見る
                  </button>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 px-1">チームを選択</p>
                    {TEAMS.map((team) => (
                      <button
                        key={team}
                        onClick={() => {
                          setViewAs("Sales", team);
                          setShowTeamPicker(false);
                          setOpen(false);
                          router.push("/sales");
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm"
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
        <div className="border-t p-3">
          <button
            onClick={() => { setOpen(false); clearViewAs(); signOut({ callbackUrl: "/login" }); }}
            className="w-full flex items-center gap-3 px-5 py-3 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">ログアウト</span>
          </button>
        </div>
      </div>
    </>
  );
}
