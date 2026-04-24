# CLAUDE.md — 人事評価システム開発メモ

## プロジェクト概要

LINE ログイン認証を使ったアポインター向け人事評価・ロードマップ管理システム。  
Next.js 15 (App Router) + NextAuth v5 + Supabase PostgreSQL + Vercel デプロイ。

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 15 App Router (`"use client"`) |
| 認証 | NextAuth v5 (LINE OAuth) |
| DB | Supabase PostgreSQL |
| デプロイ | Vercel（GitHub push で自動デプロイ） |
| スタイル | Tailwind CSS + shadcn/ui |
| テーマカラー | ゴールド `#cfa340` / クリーム `#fff9ec` |

---

## ロール一覧

| Role | 説明 |
|------|------|
| `Appointer` | アポインター（一般メンバー） |
| `AM` | アポインターマネージャー |
| `AM_Sales` | AM 兼 営業マン（兼任ロール） |
| `Sales` | 営業マン |
| `Closer` | クローザー |
| `Bridge` | ブリッジ |
| `Admin` | 管理者 |

---

## 主要ファイル構成

```
src/
├── app/
│   ├── setup/page.tsx              # 初期設定（初回ログイン）
│   ├── profile/setup/page.tsx      # プロフィール設定
│   ├── dashboard/page.tsx          # ダッシュボード（ロール振り分け）
│   ├── appointer/
│   │   ├── page.tsx                # アポインタートップ（ドーナツチャート）
│   │   └── mentors/page.tsx        # 担当者プロフィール
│   ├── am/
│   │   ├── page.tsx                # AM ダッシュボード
│   │   └── appointers/page.tsx     # AM アポインター管理
│   ├── am-sales/
│   │   ├── page.tsx                # AM_Sales ダッシュボード
│   │   └── appointers/page.tsx     # AM_Sales アポインター管理
│   ├── sales/page.tsx              # 営業マンダッシュボード
│   ├── hr/page.tsx                 # 営業マン・AM・Admin のアポインター管理
│   ├── churned/page.tsx            # 離脱メンバー管理
│   ├── admin/page.tsx              # 管理者設定
│   └── api/
│       ├── hr/route.ts             # HR サマリー API
│       ├── stats/route.ts          # ダッシュボード統計 API
│       ├── roadmap/[id]/route.ts   # ロードマップ CRUD
│       ├── performance/route.ts    # 実績データ
│       ├── sheets/                 # スプレッドシート同期
│       └── user/                   # ユーザー管理
├── components/
│   ├── roadmap/RoadmapAppointerRowDB.tsx  # ロードマップ表示コンポーネント
│   ├── accounts/AccountsEditor.tsx        # アカウント編集
│   └── accounts/AccountsView.tsx          # アカウント閲覧
└── types/
    ├── roadmap.ts    # ROADMAP_STEPS (17ステップ) / ROADMAP_PHASES 定義
    └── user.ts       # Role / TeamGroup 型
```

---

## DB テーブル構成（主要）

```sql
users               -- ユーザー情報（role, team, nickname, churned_at, paused_at など）
roadmaps            -- ロードマップ（completed_step_count, deadlines_by_step_id, am_memo, sales_memo, churned_reason など）
performance_records -- 月次実績（dm_count, appo_count, income など）
team_monthly_aggregates -- チーム月次集計
sheet_configs       -- スプレッドシート設定
```

---

## 実装済み機能

### 認証・セットアップ
- LINE OAuth ログイン
- 初期設定画面（名前・あだ名・役職・チーム・インボイス）
- プロフィール設定画面（年齢・性別・趣味・自己紹介・アイコン・イチオシ写真）

### ロードマップ（17ステップ / 4フェーズ）
- フェーズ別ステップ表示（完了:緑 / 進行中:紫 / 未来:グレー）
- 完了ボタン / 戻すボタン
- 期限入力（onBlur 自動保存）
- 全管理ロールでステップ変更可能

### ダッシュボード
- 各ロール専用ページ
- 月次実績数値（DM数・B設定数・B設定率・売上など）
- パイプラインチャート（折れ線グラフ）
- アポインタートップ：SVG ドーナツチャート（目標 DM:625通 / B設定:7件 / B設定率:1.00%）

### アポインター管理（hr・am/appointers・am-sales/appointers）
- タブ構成：ステータス / アカウント / 人事評価 / プロフィール
- ステータスタブ：採用日編集 / ロードマップ（全フェーズ・完了ボタン・期限） / 離脱・休止変更 / AMメモ / 営業マンメモ
- 離脱メンバーはリストから非表示

### 離脱データ（/churned）
- 全ロールからアクセス可能
- プロフィールタブ・アカウントタブ付き展開行
- 在籍期間・離脱時ステップ・離脱原因表示

### 管理者（/admin）
- スプレッドシート設定（DM数の取得 / B設定〜契約数の取得 / メンバーマスタの取得）
- ユーザー管理（ロール・チーム変更）
- 人事評価公開設定

---

## 実装済み Supabase マイグレーション

```sql
-- roadmaps テーブルに churned_reason を追加
ALTER TABLE roadmaps ADD COLUMN IF NOT EXISTS churned_reason TEXT NOT NULL DEFAULT '';

-- users テーブルに include_other_am_in_survey を追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS include_other_am_in_survey BOOLEAN NOT NULL DEFAULT true;
```

---

## 現在の状態（2026-04-24）

**仮完成・本番ロールアウト前の段階。**

テストメンバーを Supabase から削除し、実際のメンバーにログインしてもらい以下を確認予定：
- あだ名がスプレッドシートと一致するか
- スプレッドシートからの DM 数・実績数の自動取得が動作するか

---

## 次にやるべきこと（優先度順）

### 1. テストデータのクリーンアップ（Supabase SQL エディタ）

```sql
-- テストユーザー確認
SELECT id, nickname, name, role, team, created_at FROM users ORDER BY created_at ASC;

-- 全削除する場合
DELETE FROM users;
DELETE FROM roadmaps;
DELETE FROM performance_records;
```

### 2. 本番メンバーのログイン順序

1. **Admin** が先にログイン・セットアップ完了
2. **AM・営業マン** がログイン（アポインターの教育係選択肢に出るため先に登録が必要）
3. **アポインター** がログイン（担当AMを選択）

### 3. 動作確認チェックリスト

- [ ] あだ名とスプレッドシートの名前が一致している
- [ ] スプレッドシート設定が Admin 画面で正しく入力されている
- [ ] DM 数・B設定数が当月分で正しく取得される
- [ ] ロードマップのステップ操作が保存される
- [ ] 離脱・休止ステータス変更が反映される

### 4. 教育係リストの動的取得（現在は mockUsers から取得）

現在 `/setup` 画面の「教育係」選択肢が `src/data/mockUsers.ts` の静的データから取得されている。  
実際の AM が DB に登録されたら、API から動的に取得する方式に切り替える必要がある。

```
src/data/mockUsers.ts → /api/user/list?role=AM&team=XXX に切り替える
src/app/setup/page.tsx の getEducationMentorOptions を API fetch に変更
```

### 5. その他・余裕があれば
- アポインタートップのドーナツチャート目標値を Admin 画面から設定できるようにする
- 調査票・アンケート機能のレビュー

---

## 開発時の注意事項

- **ローカル確認**: `npm run dev`（通常 `http://localhost:3000` または `3001`）
- **本番反映**: `git push` で Vercel が自動デプロイ（数分かかる）
- **Supabase マイグレーション**: SQL エディタで手動実行が必要（自動適用されない）
- `AM_Sales` ロールは API 側のロール許可リストに明示的に追加が必要（過去に `/api/stats` で漏れがあった）
