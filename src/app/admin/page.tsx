"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Link2, CheckCircle2, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Trash2, ArrowLeft, Server, FlaskConical,
} from "lucide-react";
import type { TeamGroup, Role } from "@/types/user";

const TEAMS: TeamGroup[] = ["辻利", "LUMIA"];

// ─── シート設定フォーム ─────────────────────────────────────────

interface SheetConfigRow {
  team: TeamGroup;
  spreadsheetUrl: string;
  spreadsheetId: string;
  sheetName: string;
  columns: {
    nameColumn: string; dmCountColumn: string;
    appoCountColumn: string; incomeColumn: string;
    dataStartRow: number;
  };
  updatedAt: string;
}

function TeamSheetForm({ team, onSynced }: { team: TeamGroup; onSynced: () => void }) {
  const [cfg, setCfg]           = useState<SheetConfigRow | null>(null);
  const [url, setUrl]           = useState("");
  const [sheetName, setSheetName] = useState("");
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [nameCol, setNameCol]   = useState("A");
  const [dmCol, setDmCol]       = useState("B");
  const [appoCol, setAppoCol]   = useState("C");
  const [incomeCol, setIncomeCol] = useState("D");
  const [startRow, setStartRow] = useState("2");
  const [syncing, setSyncing]   = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string; mock?: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sheet-config?team=${encodeURIComponent(team)}`);
    if (res.ok) {
      const { configs } = await res.json();
      const found = configs?.[0] ?? null;
      if (found) {
        setCfg(found);
        setUrl(found.spreadsheetUrl);
        setSheetName(found.sheetName);
        setNameCol(found.columns.nameColumn);
        setDmCol(found.columns.dmCountColumn);
        setAppoCol(found.columns.appoCountColumn);
        setIncomeCol(found.columns.incomeColumn);
        setStartRow(String(found.columns.dataStartRow));
      }
    }
  }, [team]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaveResult(null);
    const res = await fetch("/api/sheet-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team, spreadsheetUrl: url.trim(), sheetName: sheetName.trim(),
        columns: { nameColumn: nameCol, dmCountColumn: dmCol, appoCountColumn: appoCol,
          incomeColumn: incomeCol, dataStartRow: parseInt(startRow) || 2 },
      }),
    });
    const data = await res.json();
    if (res.ok) { setSaveResult({ ok: true, msg: `保存しました (ID: ${data.config?.spreadsheetId})` }); load(); }
    else         { setSaveResult({ ok: false, msg: data.error ?? "保存に失敗しました" }); }
  }

  async function handleSync() {
    setSyncing(true); setSyncResult(null);
    const res = await fetch("/api/sheets/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team }),
    });
    const data = await res.json();
    setSyncResult({
      ok:   data.ok,
      msg:  data.ok
        ? `処理: ${data.log?.processedCount}件 / スキップ: ${data.log?.skippedCount}件`
        : (data.error ?? "同期に失敗しました"),
      mock: data.mockMode,
    });
    if (data.ok) onSynced();
    setSyncing(false);
  }

  return (
    <Card className="border-l-4" style={{ borderLeftColor: team === "辻利" ? "#6366f1" : "#ec4899" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" /> {team} スプレッドシート設定
          </CardTitle>
          {cfg && <Badge variant="secondary" className="text-xs">連携済み</Badge>}
        </div>
        {cfg && <p className="text-xs text-gray-500 truncate">ID: {cfg.spreadsheetId} · 更新: {new Date(cfg.updatedAt).toLocaleDateString("ja-JP")}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">スプレッドシートURL</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="text-xs font-mono" />
          <p className="text-xs text-gray-400">毎月URLが変わる場合は新しいURLに更新して保存してください。</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700">シート名（タブ名）</label>
          <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="例: 4月 (空の場合は最初のシート)" className="text-xs" />
        </div>

        {saveResult && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${saveResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {saveResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
            {saveResult.msg}
          </div>
        )}

        {/* 列マッピング */}
        <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700" onClick={() => setShowColumns((v) => !v)}>
          {showColumns ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          列マッピング設定（高度な設定）
        </button>
        {showColumns && (
          <div className="p-3 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[["名前列", nameCol, setNameCol], ["DM数列", dmCol, setDmCol],
                ["アポ獲得数列", appoCol, setAppoCol], ["見込み月収列", incomeCol, setIncomeCol]
              ].map(([label, value, setter]) => (
                <div key={label as string}>
                  <label className="text-gray-600 font-medium">{label as string}</label>
                  <Input value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value.toUpperCase())}
                    className="h-7 text-xs mt-0.5 font-mono uppercase" maxLength={3} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-gray-600 font-medium">データ開始行</label>
                <Input type="number" value={startRow} onChange={(e) => setStartRow(e.target.value)} className="h-7 text-xs mt-0.5 w-20" min={1} />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={handleSave} disabled={!url.trim()} size="sm">URLを保存</Button>
          <Button onClick={handleSync} disabled={syncing || !cfg} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "同期中..." : "今すぐ同期"}
          </Button>
          <Button onClick={async () => { await fetch(`/api/sheet-config?team=${team}`, { method: "DELETE" }); setCfg(null); setUrl(""); }} variant="ghost" size="sm" className="gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto">
            <Trash2 className="w-3.5 h-3.5" /> リセット
          </Button>
        </div>

        {syncResult && (
          <div className={`rounded-lg p-3 text-xs space-y-1 ${syncResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            <div className="flex items-center gap-1.5 font-semibold">
              {syncResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {syncResult.ok ? "同期成功" : "同期エラー"}
              {syncResult.mock && <span className="ml-1 bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 flex items-center gap-1"><FlaskConical className="w-3 h-3" />モック</span>}
            </div>
            <p>{syncResult.msg}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ユーザー管理テーブル ─────────────────────────────────────────

const ROLES: Role[] = ["Admin", "AM", "Bridge", "Closer", "Appointer"];

function UserManagement() {
  const [users, setUsers] = useState<Array<{ id: string; nickname?: string; name?: string; role: Role; team?: string; line_name?: string }>>([]);

  useEffect(() => {
    fetch("/api/user/list?fields=id,nickname,name,role,team,line_name")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, []);

  async function updateUser(userId: string, role: Role, team?: string) {
    await fetch("/api/user/list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role, team }),
    });
    // 再読み込み
    const r = await fetch("/api/user/list?fields=id,nickname,name,role,team,line_name");
    const d = await r.json();
    setUsers(d.users ?? []);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">ユーザー管理</CardTitle>
        <p className="text-xs text-gray-400">LINEログイン済みのユーザー一覧。ロールとチームを変更できます。</p>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">ユーザーなし（LINEログイン後に表示されます）</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg border text-sm flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{u.nickname ?? u.name ?? u.line_name ?? u.id}</p>
                  <p className="text-xs text-gray-400 truncate">{u.id}</p>
                </div>
                <select
                  className="h-8 rounded border bg-white px-2 text-xs"
                  value={u.role}
                  onChange={(e) => updateUser(u.id, e.target.value as Role, u.team)}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  className="h-8 rounded border bg-white px-2 text-xs"
                  value={u.team ?? ""}
                  onChange={(e) => updateUser(u.id, u.role, e.target.value || undefined)}
                >
                  <option value="">チームなし</option>
                  <option value="辻利">辻利</option>
                  <option value="LUMIA">LUMIA</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── メインページ ─────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [syncLogs, setSyncLogs] = useState<Array<{ id: string; team: string; syncedAt: string; status: string; processedCount: number; skippedCount: number; errorMessage?: string; mockMode?: boolean }>>([]);
  const [syncKey, setSyncKey] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && session.user.role !== "Admin") { router.replace("/dashboard"); return; }
  }, [status, session, router]);

  useEffect(() => {
    fetch("/api/sheets/config").then((r) => r.json()).then((d) => setHasCredentials(d.hasCredentials)).catch(() => setHasCredentials(false));
    fetch("/api/sync-logs?limit=30").then((r) => r.json()).then((d) => setSyncLogs(d.logs ?? []));
  }, [syncKey]);

  if (status === "loading") return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>読み込み中...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" /> ダッシュボード
          </Button>
          <Settings className="w-5 h-5 text-gray-500" />
          <h1 className="font-bold text-gray-900">Admin 設定</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* 認証状態 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4" />Google Sheets API 認証状態</CardTitle>
          </CardHeader>
          <CardContent>
            {hasCredentials === null ? <p className="text-sm text-gray-500">確認中...</p>
              : hasCredentials ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 text-sm"><CheckCircle2 className="w-4 h-4" />サービスアカウント認証が設定済みです。</div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-sm"><FlaskConical className="w-4 h-4" /><span>モックモード：<code className="bg-amber-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code> 未設定</span></div>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono"><p className="text-gray-400"># .env.local に追加 (Vercelは環境変数に設定)</p><p>GOOGLE_SERVICE_ACCOUNT_KEY=&#39;{"{"}"type":"service_account",...{"}"}'</p></div>
                </div>
              )}
          </CardContent>
        </Card>

        {/* スプシ設定 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">スプレッドシート連携設定</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {TEAMS.map((team) => (
              <TeamSheetForm key={team} team={team} onSynced={() => setSyncKey((k) => k + 1)} />
            ))}
          </div>
        </div>

        {/* ユーザー管理 */}
        <UserManagement />

        {/* 同期ログ */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">同期ログ（直近30件）</CardTitle></CardHeader>
          <CardContent>
            {syncLogs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">同期履歴がありません</p>
            ) : (
              <div className="space-y-1.5">
                {syncLogs.map((log) => (
                  <div key={log.id} className={`flex items-start gap-2 rounded px-3 py-2 text-xs ${log.status === "success" ? "bg-green-50 text-green-800" : log.status === "partial" ? "bg-yellow-50 text-yellow-800" : "bg-red-50 text-red-800"}`}>
                    <span className="font-semibold w-12 shrink-0">{log.team}</span>
                    <span className="text-gray-500 w-36 shrink-0">{new Date(log.syncedAt).toLocaleString("ja-JP")}</span>
                    <span>{log.status === "success" ? "✓" : log.status === "partial" ? "△" : "✕"} 処理 {log.processedCount}件 / スキップ {log.skippedCount}件 {log.mockMode ? "(モック)" : ""}</span>
                    {log.errorMessage && <span className="text-red-600 truncate">{log.errorMessage}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
