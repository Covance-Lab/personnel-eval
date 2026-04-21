-- ================================================================
-- AM_Sales 兼任者対応マイグレーション
-- Supabase SQL Editor に貼り付けて実行してください
-- ================================================================

-- users テーブルに include_other_am_in_survey カラムを追加
-- AM_Sales兼任者が他AMのアポインターを評価アンケート対象に含めるか制御するフラグ
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS include_other_am_in_survey BOOLEAN NOT NULL DEFAULT true;

-- コメント
COMMENT ON COLUMN users.include_other_am_in_survey IS
  'AM_Sales兼任者専用: 同チームの他AMが管理するアポインターを評価アンケート対象に含めるか（デフォルト: true）';
