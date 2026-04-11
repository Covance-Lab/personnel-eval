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
  ChevronDown, ChevronUp, Trash2, ArrowLeft, Server, FlaskConical, BarChart2, Plus,
  ClipboardList, Play, Eye, EyeOff, Users, UserPlus,
} from "lucide-react";
import type { TeamGroup, Role } from "@/types/user";
import type { PerformanceRecord } from "@/types/performance";
import { analyzePerformanceAlerts } from "@/types/performance";

const TEAMS: TeamGroup[] = ["辻利", "LUMIA"];

// ─── シート設定フォーム ─────────────────────────────────────────

interface SheetConfigRow {
  team: TeamGroup | "全チーム";
  spreadsheetUrl: string;
  spreadsheetId: string;
  sheetName: string;
  columns: {
    teamColumn?: string;
    nameColumn: string; dmCountColumn: string;
    appoCountColumn: string; incomeColumn: string;
    dataStartRow: number;
  };
  updatedAt: string;
}

function TeamSheetForm({ team, onSynced }: { team: TeamGroup | "全チーム"; onSynced: () => void }) {
  const [cfg, setCfg]           = useState<SheetConfigRow | null>(null);
  const [url, setUrl]           = useState("");
  const [sheetName, setSheetName] = useState("");
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [teamCol, setTeamCol]   = useState("A");
  const [nameCol, setNameCol]   = useState("B");
  const [dmCol, setDmCol]       = useState("C");
  const [appoCol, setAppoCol]   = useState("E");
  const [incomeCol, setIncomeCol] = useState("F");
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
        if (found.columns.teamColumn) setTeamCol(found.columns.teamColumn);
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
        columns: { teamColumn: teamCol || undefined, nameColumn: nameCol, dmCountColumn: dmCol,
          appoCountColumn: appoCol, incomeColumn: incomeCol, dataStartRow: parseInt(startRow) || 2 },
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
    <Card className="border-l-4" style={{ borderLeftColor: "#6366f1" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" /> スプレッドシート設定（全チーム統合）
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
            <p className="text-xs text-gray-500">現在のシート形式: A=チーム, B=名前, C=DM数, D=返信数, E=B設定数(アポ), F=契約数</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[["チーム列", teamCol, setTeamCol], ["名前列", nameCol, setNameCol],
                ["DM数列", dmCol, setDmCol], ["アポ獲得数列", appoCol, setAppoCol],
                ["見込み月収列", incomeCol, setIncomeCol]
              ].map(([label, value, setter]) => (
                <div key={label as string}>
                  <label className="text-gray-600 font-medium">{label as string}</label>
                  <Input value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value.toUpperCase())}
                    className="h-7 text-xs mt-0.5 font-mono uppercase" maxLength={3} />
                </div>
              ))}
              <div>
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

// ─── 集計シート設定フォーム ────────────────────────────────────────

interface AggregateConfig {
  id: string;
  year: number;
  spreadsheet_id: string;
  updated_at?: string;
}

function AggregateSheetForm() {
  const now = new Date();
  const [configs, setConfigs] = useState<AggregateConfig[]>([]);
  const [newYear, setNewYear] = useState(String(now.getFullYear()));
  const [newUrl, setNewUrl]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // 同期用state: { year, month, status }
  const [syncYear, setSyncYear]   = useState(String(now.getFullYear()));
  const [syncMonth, setSyncMonth] = useState(String(now.getMonth() + 1));
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState<{ ok: boolean; msg: string; mock?: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/aggregate-sheet-config");
    if (r.ok) { const d = await r.json(); setConfigs(d.configs ?? []); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!newUrl.trim() || !newYear) return;
    setSaving(true); setSaveMsg(null);
    const r = await fetch("/api/aggregate-sheet-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: parseInt(newYear), spreadsheetUrl: newUrl.trim() }),
    });
    const d = await r.json();
    if (r.ok) { setSaveMsg({ ok: true, msg: `${newYear}年の設定を保存しました` }); setNewUrl(""); load(); }
    else       { setSaveMsg({ ok: false, msg: d.error ?? "保存に失敗しました" }); }
    setSaving(false);
  }

  async function handleDelete(year: number) {
    await fetch(`/api/aggregate-sheet-config?year=${year}`, { method: "DELETE" });
    load();
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null);
    const r = await fetch("/api/sheets/sync-aggregate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: parseInt(syncYear), month: parseInt(syncMonth) }),
    });
    const d = await r.json();
    if (r.ok && d.ok) {
      setSyncMsg({
        ok: true, mock: d.mockMode,
        msg: `${syncYear}年${syncMonth}月 — B実施:${d.data.bExecCount} A設定:${d.data.aSetCount} A実施:${d.data.aExecCount} 契約:${d.data.contractCount} 売上:${d.data.revenue.toLocaleString()}円`,
      });
    } else {
      setSyncMsg({ ok: false, msg: d.error ?? "同期に失敗しました" });
    }
    setSyncing(false);
  }

  return (
    <Card className="border-l-4 border-l-amber-400">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart2 className="w-4 h-4" /> 集計シート設定（B実施数・A設定数・売上など）
        </CardTitle>
        <p className="text-xs text-gray-500">アポインター別シートとは別の、組織全体の集計シートを年ごとに登録します。</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* 登録済み一覧 */}
        {configs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-600">登録済み集計シート</p>
            {configs.map((c) => (
              <div key={c.year} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                <span className="font-bold text-gray-700 w-14">{c.year}年</span>
                <span className="text-gray-400 font-mono truncate flex-1">ID: {c.spreadsheet_id}</span>
                <button onClick={() => handleDelete(c.year)} className="text-red-400 hover:text-red-600 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 新規追加 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">新しい年のシートを追加</p>
          <div className="flex gap-2">
            <select
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className="h-9 rounded border bg-white px-2 text-xs shrink-0 w-24"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="text-xs font-mono"
            />
            <Button onClick={handleSave} disabled={saving || !newUrl.trim()} size="sm" className="gap-1 shrink-0">
              <Plus className="w-3.5 h-3.5" />{saving ? "保存中..." : "追加"}
            </Button>
          </div>
          {saveMsg && (
            <div className={`flex items-center gap-1.5 rounded px-3 py-2 text-xs ${saveMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {saveMsg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {saveMsg.msg}
            </div>
          )}
        </div>

        {/* 同期実行 */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-600">集計データを同期</p>
          <p className="text-xs text-gray-400">タブ名が「MM月」形式（例: 03月）のシートに対応しています。</p>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={syncYear}
              onChange={(e) => setSyncYear(e.target.value)}
              className="h-9 rounded border bg-white px-2 text-xs w-24"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <select
              value={syncMonth}
              onChange={(e) => setSyncMonth(e.target.value)}
              className="h-9 rounded border bg-white px-2 text-xs w-20"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
            <Button
              onClick={handleSync}
              disabled={syncing || configs.length === 0}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "同期中..." : "同期実行"}
            </Button>
            {configs.length === 0 && (
              <span className="text-xs text-gray-400">先にシートを登録してください</span>
            )}
          </div>
          {syncMsg && (
            <div className={`rounded-lg px-3 py-2 text-xs space-y-0.5 ${syncMsg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              <div className="flex items-center gap-1.5 font-semibold">
                {syncMsg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {syncMsg.ok ? "同期成功" : "同期エラー"}
                {syncMsg.mock && <span className="ml-1 bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 flex items-center gap-1"><FlaskConical className="w-3 h-3" />モック</span>}
              </div>
              <p>{syncMsg.msg}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ユーザー管理テーブル ─────────────────────────────────────────

const ROLES: Role[] = ["Admin", "AM", "Bridge", "Closer", "Appointer", "Sales"];

interface ManagedUser {
  id: string;
  nickname?: string;
  name?: string;
  role: Role;
  team?: string;
  line_name?: string;
  education_mentor_user_id?: string;
}

function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/user/list?fields=id,nickname,name,role,team,line_name,education_mentor_user_id");
    const d = await r.json();
    setUsers(d.users ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateUser(userId: string, patch: Partial<{ role: Role; team: string; educationMentorUserId: string | null }>) {
    await fetch("/api/user/list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    load();
  }

  const amList = users.filter((u) => u.role === "AM");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">ユーザー管理</CardTitle>
        <p className="text-xs text-gray-400">ロール・チーム・教育係（AM）を変更できます。アポインターには必ず教育係のAMを設定してください。</p>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">ユーザーなし（ログイン後に表示されます）</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const displayName = u.nickname ?? u.name ?? u.line_name ?? u.id;
              const isAppointer = u.role === "Appointer";
              return (
                <div key={u.id} className="p-2 rounded-lg border text-sm space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{displayName}</p>
                    </div>
                    {/* ロール */}
                    <select
                      className="h-8 rounded border bg-white px-2 text-xs"
                      value={u.role}
                      onChange={(e) => updateUser(u.id, { role: e.target.value as Role, team: u.team })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {/* チーム */}
                    <select
                      className="h-8 rounded border bg-white px-2 text-xs"
                      value={u.team ?? ""}
                      onChange={(e) => updateUser(u.id, { role: u.role, team: e.target.value || undefined })}
                    >
                      <option value="">チームなし</option>
                      <option value="辻利">辻利</option>
                      <option value="LUMIA">LUMIA</option>
                    </select>
                  </div>
                  {/* 教育係（Appointerのみ） */}
                  {isAppointer && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 shrink-0">教育係（AM）:</span>
                      <select
                        className="h-7 rounded border bg-white px-2 text-xs flex-1"
                        value={u.education_mentor_user_id ?? ""}
                        onChange={(e) =>
                          updateUser(u.id, { educationMentorUserId: e.target.value || null })
                        }
                      >
                        <option value="">未設定</option>
                        {amList.map((am) => (
                          <option key={am.id} value={am.id}>
                            {am.nickname ?? am.name ?? am.line_name ?? am.id}
                            {am.team ? ` (${am.team})` : ""}
                          </option>
                        ))}
                      </select>
                      {u.education_mentor_user_id && (
                        <span className="text-xs text-green-600 font-semibold shrink-0">設定済み</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 管理者向け: アポインター一覧（実績+プロフィール+ステータス） ─────────

interface AppointerUserRow {
  id: string;
  nickname?: string;
  name?: string;
  role: Role;
  team?: string;
  line_name?: string;
  line_picture_url?: string;
  setup_completed?: boolean;
  age?: number | null;
  gender?: string | null;
  hobbies?: string | null;
  self_introduction?: string | null;
  icon_image_url?: string | null;
}

function toClientRecords(rows: Record<string, unknown>[]): PerformanceRecord[] {
  return (rows ?? []).map((r) => ({
    userId: r.user_id as string,
    sheetName: (r.sheet_name as string) ?? "",
    year: r.year as number,
    month: r.month as number,
    dmCount: r.dm_count as number,
    appoCount: r.appo_count as number,
    appointmentRate: Number(r.appointment_rate),
    income: r.income as number,
    team: r.team as TeamGroup,
    syncedAt: r.synced_at as string,
    expectedIncome: r.expected_income as number | undefined,
  }));
}

function AppointerOverview() {
  const [users, setUsers] = useState<AppointerUserRow[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [usersRes, perfRes] = await Promise.all([
          fetch(
            "/api/user/list?role=Appointer&fields=id,nickname,name,role,team,line_name,line_picture_url,setup_completed,age,gender,hobbies,self_introduction,icon_image_url"
          ),
          fetch("/api/performance"),
        ]);

        const usersJson = await usersRes.json();
        const perfJson = await perfRes.json();
        if (!active) return;
        setUsers((usersJson.users ?? []) as AppointerUserRow[]);
        setRecords(toClientRecords(perfJson.records ?? []));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const byUser = new Map<string, PerformanceRecord[]>();
  records.forEach((r) => {
    const arr = byUser.get(r.userId) ?? [];
    arr.push(r);
    byUser.set(r.userId, arr);
  });
  byUser.forEach((arr) =>
    arr.sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month))
  );

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">
            アポインター一覧（実績・プロフィール）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">
          アポインター一覧（実績・プロフィール・ステータス）
        </CardTitle>
        <p className="text-xs text-gray-400">
          スプレッドシート同期済みの実績と、設定済みプロフィールをまとめて確認できます
        </p>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">アポインターがまだ登録されていません</p>
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const userRecords = byUser.get(u.id) ?? [];
              const latest = userRecords[0] ?? null;
              const alerts = analyzePerformanceAlerts(userRecords);
              const hasCritical = alerts.some((a) => a.severity === "critical");
              const hasWarning = !hasCritical && alerts.some((a) => a.severity === "warning");

              const status = !u.setup_completed
                ? { label: "未設定", cls: "bg-gray-100 text-gray-700" }
                : !latest
                ? { label: "同期待ち", cls: "bg-amber-100 text-amber-700" }
                : hasCritical
                ? { label: "要対応", cls: "bg-red-100 text-red-700" }
                : hasWarning
                ? { label: "注意", cls: "bg-yellow-100 text-yellow-700" }
                : { label: "稼働中", cls: "bg-green-100 text-green-700" };

              const displayName = u.nickname ?? u.name ?? u.line_name ?? u.id;
              const avatar = u.icon_image_url ?? u.line_picture_url ?? null;

              return (
                <div key={u.id} className="rounded-lg border p-3 bg-white">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt={displayName}
                          className="w-11 h-11 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gray-100 border flex items-center justify-center text-xs text-gray-500">
                          {displayName.slice(0, 1)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm">{displayName}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {u.team ?? "チーム未設定"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-gray-50 rounded px-2 py-1">
                          <p className="text-gray-500">最新DM</p>
                          <p className="font-semibold">{latest ? latest.dmCount : "—"}</p>
                        </div>
                        <div className="bg-gray-50 rounded px-2 py-1">
                          <p className="text-gray-500">最新アポ</p>
                          <p className="font-semibold">{latest ? latest.appoCount : "—"}</p>
                        </div>
                        <div className="bg-gray-50 rounded px-2 py-1">
                          <p className="text-gray-500">獲得率</p>
                          <p className="font-semibold">{latest ? `${latest.appointmentRate}%` : "—"}</p>
                        </div>
                        <div className="bg-gray-50 rounded px-2 py-1">
                          <p className="text-gray-500">見込み月収</p>
                          <p className="font-semibold">{latest ? `${latest.income.toLocaleString()}円` : "—"}</p>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                        <p>年齢: {u.age ?? "未設定"} / 性別: {u.gender ?? "未設定"}</p>
                        <p>趣味: {u.hobbies?.trim() ? u.hobbies : "未設定"}</p>
                        <p className="truncate">自己紹介: {u.self_introduction?.trim() ? u.self_introduction : "未設定"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── テストユーザー管理（TEST_MODE=true のみ表示） ─────────────────────────

const IS_TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === "true";

const TEST_ROLES: Role[] = ["Admin", "Sales", "AM", "Appointer"];
const ROLE_COLORS: Record<string, string> = {
  Admin:     "bg-purple-100 text-purple-700",
  AM:        "bg-blue-100 text-blue-700",
  Sales:     "bg-green-100 text-green-700",
  Appointer: "bg-indigo-100 text-indigo-700",
};

interface TestUser {
  id: string; nickname?: string; name?: string; line_name?: string;
  role: string; team?: string;
}

function TestUserManager() {
  const [users, setUsers]       = useState<TestUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState("");
  const [newRole, setNewRole]   = useState<Role>("Appointer");
  const [newTeam, setNewTeam]   = useState("");
  const [newMentor, setNewMentor] = useState("");   // Appointer作成時の教育係AM ID
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/test-users");
    if (r.ok) { const d = await r.json(); setUsers(d.users ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const amList = users.filter((u) => u.role === "AM");

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true); setMsg(null);
    const r = await fetch("/api/test-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        role: newRole,
        team: newTeam || undefined,
        educationMentorUserId: newRole === "Appointer" && newMentor ? newMentor : undefined,
      }),
    });
    const d = await r.json();
    if (r.ok) { setMsg({ ok: true, text: `「${newName}」を追加しました` }); setNewName(""); setNewMentor(""); load(); }
    else       { setMsg({ ok: false, text: d.error ?? "追加に失敗しました" }); }
    setSaving(false);
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    const r = await fetch(`/api/test-users?userId=${userId}`, { method: "DELETE" });
    if (r.ok) { setMsg({ ok: true, text: `「${name}」を削除しました` }); load(); }
    else { const d = await r.json(); setMsg({ ok: false, text: d.error ?? "削除に失敗しました" }); }
  }

  return (
    <Card className="border-l-4 border-l-amber-400">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="w-4 h-4" /> テストユーザー管理
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-normal">TEST MODE</span>
        </CardTitle>
        <p className="text-xs text-gray-500">LINEを使わずにログインできるテストアカウントを作成します。ログイン画面に一覧表示されます。</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* 追加フォーム */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">新しいテストユーザーを追加</p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="表示名（例: テスト太郎）"
              className="text-sm flex-1 min-w-32"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              className="h-9 rounded border bg-white px-2 text-xs"
            >
              {TEST_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              className="h-9 rounded border bg-white px-2 text-xs"
            >
              <option value="">チームなし</option>
              <option value="辻利">辻利</option>
              <option value="LUMIA">LUMIA</option>
            </select>
            <Button onClick={handleAdd} disabled={saving || !newName.trim()} size="sm" className="gap-1.5 shrink-0">
              <UserPlus className="w-3.5 h-3.5" />
              {saving ? "追加中..." : "追加"}
            </Button>
          </div>
          {/* Appointer選択時：教育係AM選択 */}
          {newRole === "Appointer" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 shrink-0">教育係（AM）:</span>
              <select
                value={newMentor}
                onChange={(e) => setNewMentor(e.target.value)}
                className="h-8 rounded border bg-white px-2 text-xs flex-1"
              >
                <option value="">未設定（後で設定可）</option>
                {amList.map((am) => (
                  <option key={am.id} value={am.id}>
                    {am.nickname ?? am.name ?? am.line_name ?? am.id}
                    {am.team ? ` (${am.team})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {msg && (
            <div className={`flex items-center gap-1.5 rounded px-3 py-2 text-xs ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {msg.text}
            </div>
          )}
        </div>

        {/* ユーザー一覧 */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-700">登録済みユーザー（{users.length}名）</p>
          {loading ? (
            <p className="text-xs text-gray-400">読み込み中...</p>
          ) : users.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3 border rounded-lg">まだユーザーがいません</p>
          ) : (
            <div className="space-y-1.5">
              {users.map((u) => {
                const displayName = u.nickname ?? u.name ?? u.line_name ?? u.id;
                return (
                  <div key={u.id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {u.role}
                    </span>
                    <span className="text-sm font-medium text-gray-800 flex-1">{displayName}</span>
                    {u.team && <span className="text-xs text-gray-400">{u.team}</span>}
                    <button
                      onClick={() => handleDelete(u.id, displayName)}
                      className="shrink-0 text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

// ─── アンケート提出状況 + 評価算出 ────────────────────────────────────────

interface SurveyStatusUser {
  id: string; name: string; role: string; team?: string;
  required: number; submitted: number; fullySubmitted: boolean;
}

interface EvalResult {
  user_id: string; year: number; month: number;
  workload_score: number | null; performance_score: number | null;
  dm_count: number | null; b_set_rate: number | null;
  discipline_self: number | null; absorption_self: number | null;
  contribution_self: number | null; thinking_self: number | null;
  discipline_other: number | null; absorption_other: number | null;
  contribution_other: number | null; thinking_other: number | null;
  visible_to_user: boolean;
  users?: { nickname?: string; name?: string; role: string; team?: string };
}

function EvaluationSection() {
  const now = new Date();
  const [selYear, setSelYear]   = useState(String(now.getFullYear()));
  const [selMonth, setSelMonth] = useState(String(now.getMonth() + 1));

  const [statusUsers, setStatusUsers]     = useState<SurveyStatusUser[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusLoaded, setStatusLoaded]   = useState(false);

  const [calcLoading, setCalcLoading] = useState(false);
  const [calcMsg, setCalcMsg]         = useState<{ ok: boolean; msg: string } | null>(null);

  const [results, setResults]       = useState<EvalResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsLoaded, setResultsLoaded]   = useState(false);

  async function loadStatus() {
    setStatusLoading(true);
    const r = await fetch(`/api/admin/survey-status?year=${selYear}&month=${selMonth}`);
    if (r.ok) { const d = await r.json(); setStatusUsers(d.users ?? []); setStatusLoaded(true); }
    setStatusLoading(false);
  }

  async function loadResults() {
    setResultsLoading(true);
    const r = await fetch(`/api/admin/evaluate?year=${selYear}&month=${selMonth}`);
    if (r.ok) { const d = await r.json(); setResults(d.results ?? []); setResultsLoaded(true); }
    setResultsLoading(false);
  }

  async function handleCalculate() {
    if (!confirm(`${selYear}年${selMonth}月の評価を算出しますか？\n既存の結果は上書きされます。`)) return;
    setCalcLoading(true); setCalcMsg(null);
    const r = await fetch("/api/admin/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: parseInt(selYear), month: parseInt(selMonth) }),
    });
    const d = await r.json();
    if (r.ok && d.ok) { setCalcMsg({ ok: true, msg: `${d.count}名分の評価を算出しました` }); loadResults(); }
    else               { setCalcMsg({ ok: false, msg: d.error ?? "算出に失敗しました" }); }
    setCalcLoading(false);
  }

  async function toggleVisible(userId: string, current: boolean) {
    await fetch("/api/admin/evaluate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: parseInt(selYear), month: parseInt(selMonth), userId, visibleToUser: !current }),
    });
    setResults((prev) => prev.map((r) => r.user_id === userId ? { ...r, visible_to_user: !current } : r));
  }

  const doneCount = statusUsers.filter((u) => u.fullySubmitted).length;

  return (
    <Card className="border-l-4 border-l-purple-400">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> アンケート提出状況・評価算出
        </CardTitle>
        <p className="text-xs text-gray-500">アンケート締切後、提出状況を確認してから評価を算出します。</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* 年月セレクタ */}
        <div className="flex gap-2 items-center">
          <select value={selYear} onChange={(e) => setSelYear(e.target.value)} className="h-9 rounded border bg-white px-2 text-xs w-24">
            {Array.from({ length: 3 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select value={selMonth} onChange={(e) => setSelMonth(e.target.value)} className="h-9 rounded border bg-white px-2 text-xs w-20">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={loadStatus} disabled={statusLoading} className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {statusLoading ? "取得中..." : "提出状況を確認"}
          </Button>
        </div>

        {/* 提出状況テーブル */}
        {statusLoaded && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-gray-700">
                提出状況: {doneCount} / {statusUsers.length} 名完了
              </p>
              {doneCount === statusUsers.length && statusUsers.length > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">全員完了</span>
              )}
            </div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">名前</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">ロール</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">チーム</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">提出状況</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {statusUsers.map((u) => (
                    <tr key={u.id} className={u.fullySubmitted ? "bg-white" : "bg-red-50"}>
                      <td className="px-3 py-2 font-medium">{u.name}</td>
                      <td className="px-3 py-2 text-gray-500">{u.role}</td>
                      <td className="px-3 py-2 text-gray-500">{u.team ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {u.fullySubmitted ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 完了
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" /> {u.submitted}/{u.required}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 評価算出ボタン */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-700">評価を算出する</p>
          <p className="text-xs text-gray-400">
            ・定量評価（稼働量・成果）は前月の実績データを使用します<br />
            ・定性評価（規律・吸収力・組織貢献・思考力）は今月のアンケート回答を使用します
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={handleCalculate} disabled={calcLoading} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
              <Play className="w-3.5 h-3.5" />
              {calcLoading ? "算出中..." : "結果算出スタート"}
            </Button>
            <Button size="sm" variant="outline" onClick={loadResults} disabled={resultsLoading} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${resultsLoading ? "animate-spin" : ""}`} />
              結果を表示
            </Button>
          </div>
          {calcMsg && (
            <div className={`flex items-center gap-1.5 rounded px-3 py-2 text-xs ${calcMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {calcMsg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {calcMsg.msg}
            </div>
          )}
        </div>

        {/* 算出結果一覧 + 表示切替 */}
        {resultsLoaded && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">
              算出結果（{results.length}名）
              <span className="ml-2 font-normal text-gray-400">— 目のアイコンで個人への表示/非表示を切替</span>
            </p>
            {results.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">まだ算出されていません</p>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">名前</th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600">稼働量</th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600">成果</th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600">規律</th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600">吸収力</th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600">組織貢献</th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600">思考力</th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600">表示</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((r) => {
                      const uName = r.users?.nickname ?? r.users?.name ?? r.user_id;
                      return (
                        <tr key={r.user_id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <p className="font-medium">{uName}</p>
                            <p className="text-gray-400">{r.users?.role} · {r.users?.team ?? "—"}</p>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {r.workload_score != null ? (
                              <ScorePill score={r.workload_score} />
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {r.performance_score != null ? (
                              <ScorePill score={r.performance_score} />
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          {(["discipline", "absorption", "contribution", "thinking"] as const).map((k) => (
                            <td key={k} className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-indigo-600 font-semibold">{(r[`${k}_self` as keyof EvalResult] as number | null) ?? "—"}</span>
                                <span className="text-gray-300">/</span>
                                <span className="text-pink-600 font-semibold">
                                  {(r[`${k}_other` as keyof EvalResult] as number | null) != null
                                    ? Number(r[`${k}_other` as keyof EvalResult]).toFixed(1)
                                    : "—"}
                                </span>
                              </div>
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => toggleVisible(r.user_id, r.visible_to_user)}
                              className={`p-1.5 rounded-full transition-colors ${r.visible_to_user ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                              title={r.visible_to_user ? "表示中（クリックで非表示に）" : "非表示（クリックで表示に）"}
                            >
                              {r.visible_to_user ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-400">
              <span className="text-indigo-600 font-semibold">青</span>= 自己評価
              <span className="text-pink-600 font-semibold">ピンク</span>= 他者評価（平均）
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

function ScorePill({ score }: { score: number }) {
  const colors: Record<number, string> = {
    5: "bg-green-100 text-green-800",
    4: "bg-blue-100 text-blue-800",
    3: "bg-yellow-100 text-yellow-800",
    2: "bg-orange-100 text-orange-800",
    1: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${colors[score] ?? "bg-gray-100 text-gray-600"}`}>
      {score}点
    </span>
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
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">スプレッドシート連携設定</h2>
          <TeamSheetForm key="全チーム" team="全チーム" onSynced={() => setSyncKey((k) => k + 1)} />
          <AggregateSheetForm />
        </div>

        {/* テストユーザー管理（TEST_MODE のみ） */}
        {IS_TEST_MODE && <TestUserManager />}

        {/* アンケート提出状況・評価算出 */}
        <EvaluationSection />

        {/* ユーザー管理 */}
        <UserManagement />

        {/* アポインター可視化一覧 */}
        <AppointerOverview />

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
