-- ================================================================
-- user_accounts テーブル追加マイグレーション
-- Supabase SQL Editor に貼り付けて実行してください
-- ================================================================

CREATE TABLE IF NOT EXISTS user_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot        INTEGER NOT NULL CHECK (slot >= 1 AND slot <= 10),
  url         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT '使用中（DM送信）',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slot)
);

-- RLS（Row Level Security）: supabaseAdmin（service_role）は全行アクセス可
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- service_role は全アクセス可
CREATE POLICY "service_role full access" ON user_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
