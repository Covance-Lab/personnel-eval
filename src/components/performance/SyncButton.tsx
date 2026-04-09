"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamGroup } from "@/types/user";

interface SyncLog {
  status: "success" | "partial" | "error";
  syncedAt: string;
  processedCount: number;
  skippedCount: number;
  errorMessage?: string;
}

interface Props {
  team: TeamGroup;
  onSynced?: () => void;
}

export default function SyncButton({ team, onSynced }: Props) {
  const [syncing, setSyncing]     = useState(false);
  const [lastLog, setLastLog]     = useState<SyncLog | null>(null);
  const [isMock, setIsMock]       = useState(false);
  const [noConfig, setNoConfig]   = useState(false);

  async function handleSync() {
    setSyncing(true);
    setNoConfig(false);
    try {
      const res = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team }),
      });
      const data = await res.json();

      if (res.status === 404) {
        setNoConfig(true);
        return;
      }

      setLastLog(data.log ?? null);
      setIsMock(data.mockMode ?? false);
      if (data.ok) onSynced?.();
    } catch (e) {
      setLastLog({
        status: "error",
        syncedAt: new Date().toISOString(),
        processedCount: 0,
        skippedCount: 0,
        errorMessage: String(e),
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {noConfig && (
        <p className="text-xs text-amber-600">
          Admin設定でスプレッドシートURLを登録してください
        </p>
      )}

      {lastLog && !noConfig && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {lastLog.status === "success" || lastLog.status === "partial" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          )}
          最終更新:{" "}
          {new Date(lastLog.syncedAt).toLocaleString("ja-JP", {
            month: "short",
            day:   "numeric",
            hour:  "2-digit",
            minute: "2-digit",
          })}
          {isMock && (
            <span className="flex items-center gap-0.5 text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
              <FlaskConical className="w-3 h-3" />
              モック
            </span>
          )}
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={handleSync}
        disabled={syncing}
        className="gap-1.5 h-8 text-xs"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "同期中..." : "今すぐ同期"}
      </Button>
    </div>
  );
}
