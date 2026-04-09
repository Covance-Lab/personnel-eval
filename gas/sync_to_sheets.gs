/**
 * ================================================================
 * アポインター管理システム — DB → Google Sheets 同期スクリプト
 * ================================================================
 *
 * 【設定方法】
 * 1. Google スプレッドシートを新規作成（管理者用分析シート）
 * 2. ツール > スクリプトエディタ でこのコードを貼り付け
 * 3. プロジェクトの設定 > スクリプト プロパティ に以下を追加:
 *    - SUPABASE_URL        : https://xxxx.supabase.co
 *    - SUPABASE_SERVICE_KEY: service_role キー
 * 4. "syncAllToSheets" 関数を実行（初回は権限承認が必要）
 * 5. トリガーを設定: 時間主導型 → 毎日（または毎時）実行
 *
 * 【出力シート】
 * - 実績データ   : 全アポインターの月次実績
 * - ユーザー一覧 : 登録ユーザー情報
 * - 同期ログ     : 同期実行履歴
 * ================================================================
 */

// ─── 設定 ─────────────────────────────────────────────────────────

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    supabaseUrl:        props.getProperty("SUPABASE_URL"),
    supabaseServiceKey: props.getProperty("SUPABASE_SERVICE_KEY"),
  };
}

// ─── Supabase REST API 呼び出し ────────────────────────────────────

function supabaseFetch(endpoint, options) {
  const { supabaseUrl, supabaseServiceKey } = getConfig();
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("スクリプト プロパティ SUPABASE_URL / SUPABASE_SERVICE_KEY を設定してください");
  }

  const url = `${supabaseUrl}/rest/v1/${endpoint}`;
  const response = UrlFetchApp.fetch(url, {
    method:             options.method ?? "GET",
    headers: {
      "apikey":         supabaseServiceKey,
      "Authorization":  `Bearer ${supabaseServiceKey}`,
      "Content-Type":   "application/json",
      "Prefer":         "return=representation",
      ...(options.headers ?? {}),
    },
    payload:            options.payload ? JSON.stringify(options.payload) : undefined,
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`Supabase API エラー (${code}): ${response.getContentText()}`);
  }

  const text = response.getContentText();
  return text ? JSON.parse(text) : [];
}

// ─── シートへの書き込み共通 ────────────────────────────────────────

function writeSheet(spreadsheet, sheetName, headers, rows) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  } else {
    sheet.clearContents();
  }

  // ヘッダー行
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#f3f4f6");

  // データ行
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // 列幅自動調整
  sheet.autoResizeColumns(1, headers.length);

  return rows.length;
}

// ─── 実績データシート ──────────────────────────────────────────────

function syncPerformanceSheet(spreadsheet) {
  // ユーザー情報も JOIN して取得
  const records = supabaseFetch(
    "performance_records?select=*,users(nickname,name,team,role)&order=year.desc,month.desc",
    {}
  );

  const headers = [
    "ユーザーID", "あだ名", "本名", "チーム", "年", "月",
    "DM数", "アポ獲得数", "アポ獲得率(%)", "見込み月収(円)", "同期日時",
  ];

  const rows = records.map((r) => [
    r.user_id,
    r.users?.nickname ?? "",
    r.users?.name     ?? "",
    r.team            ?? r.users?.team ?? "",
    r.year,
    r.month,
    r.dm_count,
    r.appo_count,
    Number(r.appointment_rate).toFixed(1),
    r.income,
    r.synced_at ? new Date(r.synced_at).toLocaleString("ja-JP") : "",
  ]);

  return writeSheet(spreadsheet, "実績データ", headers, rows);
}

// ─── ユーザー一覧シート ────────────────────────────────────────────

function syncUsersSheet(spreadsheet) {
  const users = supabaseFetch(
    "users?select=id,nickname,name,role,team,setup_completed,expected_income,created_at&order=team,role",
    {}
  );

  const headers = [
    "ユーザーID", "あだ名", "本名", "ロール", "チーム",
    "セットアップ完了", "期待月収(円)", "登録日",
  ];

  const rows = users.map((u) => [
    u.id,
    u.nickname         ?? "",
    u.name             ?? "",
    u.role,
    u.team             ?? "",
    u.setup_completed ? "✓" : "",
    u.expected_income  ?? "",
    u.created_at ? new Date(u.created_at).toLocaleDateString("ja-JP") : "",
  ]);

  return writeSheet(spreadsheet, "ユーザー一覧", headers, rows);
}

// ─── 同期ログシート ────────────────────────────────────────────────

function syncLogsSheet(spreadsheet) {
  const logs = supabaseFetch(
    "sync_logs?select=*&order=synced_at.desc&limit=200",
    {}
  );

  const headers = ["チーム", "同期日時", "ステータス", "処理件数", "スキップ件数", "モック", "エラー"];

  const rows = logs.map((l) => [
    l.team,
    l.synced_at ? new Date(l.synced_at).toLocaleString("ja-JP") : "",
    l.status,
    l.processed_count,
    l.skipped_count,
    l.mock_mode ? "✓" : "",
    l.error_message ?? "",
  ]);

  return writeSheet(spreadsheet, "同期ログ", headers, rows);
}

// ─── アポ獲得率トレンドシート ─────────────────────────────────────

function syncTrendSheet(spreadsheet) {
  // ユーザーごと × 月ごとのアポ獲得率を取得
  const records = supabaseFetch(
    "performance_records?select=user_id,year,month,appointment_rate,dm_count,income,users(nickname)&order=user_id,year,month",
    {}
  );

  // ユーザー×月のグリッドに変換（ピボット）
  const userMap = {}; // userId → {nickname, monthMap}
  records.forEach((r) => {
    if (!userMap[r.user_id]) {
      userMap[r.user_id] = { nickname: r.users?.nickname ?? r.user_id, months: {} };
    }
    const key = `${r.year}/${String(r.month).padStart(2, "0")}`;
    userMap[r.user_id].months[key] = {
      rate:   Number(r.appointment_rate).toFixed(1),
      dm:     r.dm_count,
      income: r.income,
    };
  });

  // 全ての月を収集してソート
  const allMonths = [...new Set(records.map((r) => `${r.year}/${String(r.month).padStart(2, "0")}`))].sort();

  const headers = ["あだ名", ...allMonths.flatMap((m) => [`${m} DM数`, `${m} アポ獲得率(%)`, `${m} 月収`])];

  const rows = Object.values(userMap).map((u) => {
    const nickname = u.nickname;
    const cells = allMonths.flatMap((m) => {
      const d = u.months[m];
      return d ? [d.dm, d.rate, d.income] : ["", "", ""];
    });
    return [nickname, ...cells];
  });

  return writeSheet(spreadsheet, "実績トレンド", headers, rows);
}

// ─── メイン関数 ────────────────────────────────────────────────────

/**
 * メイン実行関数
 * GASのトリガーで定期実行するか、手動で実行してください
 */
function syncAllToSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const startTime   = new Date();

  try {
    const perfCount  = syncPerformanceSheet(spreadsheet);
    const userCount  = syncUsersSheet(spreadsheet);
    const logCount   = syncLogsSheet(spreadsheet);
    syncTrendSheet(spreadsheet);

    // サマリーシート更新
    updateSummarySheet(spreadsheet, {
      updatedAt:  startTime,
      perfCount,
      userCount,
      logCount,
    });

    Logger.log(`✓ 同期完了: 実績${perfCount}件, ユーザー${userCount}件, ログ${logCount}件`);
    SpreadsheetApp.getUi()?.alert(`✓ 同期完了\n実績: ${perfCount}件\nユーザー: ${userCount}件`);
  } catch (e) {
    Logger.log(`✕ エラー: ${e.message}`);
    SpreadsheetApp.getUi()?.alert(`✕ 同期エラー:\n${e.message}`);
  }
}

function updateSummarySheet(spreadsheet, { updatedAt, perfCount, userCount, logCount }) {
  let sheet = spreadsheet.getSheetByName("📊 サマリー");
  if (!sheet) sheet = spreadsheet.insertSheet("📊 サマリー", 0);
  sheet.clearContents();

  const data = [
    ["アポインター管理システム — 管理者分析シート", ""],
    ["", ""],
    ["最終同期日時", updatedAt.toLocaleString("ja-JP")],
    ["実績データ件数", perfCount],
    ["ユーザー数", userCount],
    ["同期ログ件数", logCount],
    ["", ""],
    ["シート一覧", ""],
    ["📋 実績データ", "全アポインターの月次実績（DM数・アポ獲得数・月収）"],
    ["📈 実績トレンド", "ユーザー×月のアポ獲得率ピボット表"],
    ["👥 ユーザー一覧", "登録ユーザー情報・ロール・チーム"],
    ["🔄 同期ログ", "スプシ同期の実行履歴"],
  ];

  sheet.getRange(1, 1, data.length, 2).setValues(data);
  sheet.getRange(1, 1, 1, 2).setFontSize(14).setFontWeight("bold");
  sheet.autoResizeColumns(1, 2);
}

// ─── トリガー設定ヘルパー ──────────────────────────────────────────

/**
 * 毎日 AM 6:00 に自動同期するトリガーを設定する
 * 一度だけ実行すればOK
 */
function setupDailyTrigger() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "syncAllToSheets") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 毎日 AM 6:00 に実行
  ScriptApp.newTrigger("syncAllToSheets")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log("✓ 毎日 AM 6:00 の自動同期トリガーを設定しました");
}
