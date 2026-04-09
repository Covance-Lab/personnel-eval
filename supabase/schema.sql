-- ================================================================
-- アポインター評価・離脱防止管理システム — Supabase スキーマ
-- Supabase SQL Editor に貼り付けて実行してください
-- ================================================================

-- ─── 拡張機能 ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── users テーブル ───────────────────────────────────────────────
-- LINEログインで作成されるユーザー情報
CREATE TABLE IF NOT EXISTS users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id                 TEXT UNIQUE NOT NULL,            -- LINE providerAccountId
  line_name               TEXT,                            -- LINEの表示名
  line_picture_url        TEXT,                            -- LINEのプロフィール画像URL
  role                    TEXT NOT NULL DEFAULT 'Appointer', -- 'Admin'|'AM'|'Sales'|'Bridge'|'Closer'|'Appointer'
  name                    TEXT,                            -- 本名
  nickname                TEXT,                            -- あだ名（スプシ紐付けキー）
  team                    TEXT,                            -- '辻利' | 'LUMIA'
  education_mentor_user_id TEXT,                           -- 教育係のusers.id
  age                     INTEGER,
  gender                  TEXT,
  hobbies                 TEXT,
  self_introduction       TEXT,
  icon_image_url          TEXT,
  featured_image_1_url    TEXT,
  featured_image_2_url    TEXT,
  setup_completed         BOOLEAN NOT NULL DEFAULT FALSE,
  expected_income         INTEGER,                         -- 本人設定の期待月収（円）
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── performance_records テーブル ─────────────────────────────────
-- スプレッドシートから同期したアポインター月次実績
CREATE TABLE IF NOT EXISTS performance_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sheet_name          TEXT,                               -- スプシ上の名前
  year                INTEGER NOT NULL,
  month               INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  dm_count            INTEGER NOT NULL DEFAULT 0,
  appo_count          INTEGER NOT NULL DEFAULT 0,
  appointment_rate    DECIMAL(5,2) NOT NULL DEFAULT 0,    -- % (例: 15.5)
  income              INTEGER NOT NULL DEFAULT 0,          -- 見込み月収（円）
  team                TEXT,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

-- ─── sync_logs テーブル ───────────────────────────────────────────
-- スプシ同期の実行ログ
CREATE TABLE IF NOT EXISTS sync_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team              TEXT NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  processed_count   INTEGER NOT NULL DEFAULT 0,
  skipped_count     INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  mock_mode         BOOLEAN NOT NULL DEFAULT FALSE
);

-- ─── sheet_configs テーブル ───────────────────────────────────────
-- チームごとのGoogleスプレッドシート連携設定
CREATE TABLE IF NOT EXISTS sheet_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team                TEXT UNIQUE NOT NULL,
  spreadsheet_url     TEXT NOT NULL,
  spreadsheet_id      TEXT NOT NULL,
  sheet_name          TEXT NOT NULL DEFAULT '',
  name_column         TEXT NOT NULL DEFAULT 'A',
  dm_count_column     TEXT NOT NULL DEFAULT 'B',
  appo_count_column   TEXT NOT NULL DEFAULT 'C',
  income_column       TEXT NOT NULL DEFAULT 'D',
  data_start_row      INTEGER NOT NULL DEFAULT 2,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── roadmaps テーブル ────────────────────────────────────────────
-- アポインターのデビューロードマップ進捗
CREATE TABLE IF NOT EXISTS roadmaps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_step_count  INTEGER NOT NULL DEFAULT 0 CHECK (completed_step_count BETWEEN 0 AND 6),
  deadlines_by_step_id  JSONB NOT NULL DEFAULT '{}',      -- {stepId: ISO string}
  am_memo               TEXT NOT NULL DEFAULT '',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── questionnaire_answers テーブル ──────────────────────────────
-- 月次セルフチェックアンケート回答
CREATE TABLE IF NOT EXISTS questionnaire_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_key     TEXT NOT NULL,                            -- 'YYYY-MM'
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  self_check    TEXT,
  next_action   TEXT,
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  UNIQUE (user_id, month_key)
);

-- ─── evaluation_records テーブル ─────────────────────────────────
-- 6軸評価レコード（本人評価 + AM評価）
CREATE TABLE IF NOT EXISTS evaluation_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_year         INTEGER NOT NULL,
  period_month        INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  scores              JSONB NOT NULL DEFAULT '{}',        -- EvaluationScores型
  overall_self_score  DECIMAL(3,1),
  overall_am_score    DECIMAL(3,1),
  self_submitted_at   TIMESTAMPTZ,
  am_submitted_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_year, period_month)
);

-- ─── updated_at トリガー ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users', 'roadmaps', 'evaluation_records']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I;
       CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─── インデックス ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_line_id       ON users (line_id);
CREATE INDEX IF NOT EXISTS idx_users_team_role     ON users (team, role);
CREATE INDEX IF NOT EXISTS idx_perf_user_year_month ON performance_records (user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_perf_team_year_month ON performance_records (team, year, month);
CREATE INDEX IF NOT EXISTS idx_sync_logs_team       ON sync_logs (team, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_questionnaire_user   ON questionnaire_answers (user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_evaluation_user      ON evaluation_records (user_id, period_year, period_month);

-- ─── Row Level Security (RLS) ─────────────────────────────────────
-- サーバーサイドは SERVICE_ROLE キーで RLS をバイパスします
-- クライアントからの直接アクセスを防ぐため全テーブルで RLS を有効化
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_configs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_records   ENABLE ROW LEVEL SECURITY;

-- サービスロール（バックエンド）は全アクセス可（デフォルト動作）
-- anon/authenticated ロールからのアクセスはすべて拒否
-- （アプリはすべて API Route 経由でアクセスするため）

-- ─── 管理者初期ユーザーの挿入例 ──────────────────────────────────
-- 初回ログイン後、LINE ID を確認して以下を実行してください:
--
-- UPDATE users
-- SET role = 'Admin'
-- WHERE line_id = 'YOUR_LINE_ID_HERE';
--
-- チームAM:
-- UPDATE users
-- SET role = 'AM', team = '辻利'
-- WHERE line_id = 'AM_LINE_ID_HERE';
