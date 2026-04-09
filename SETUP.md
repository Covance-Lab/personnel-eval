# 本番デプロイ セットアップガイド

このガイドに沿って作業すれば、約 **30〜45分** でデプロイ完了します。

---

## ステップ 1 — Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) にアクセスして無料アカウントを作成
2. **New Project** → プロジェクト名・DB パスワードを設定（東京リージョン推奨）
3. プロジェクトが起動したら **SQL Editor** を開く
4. `supabase/schema.sql` の内容を貼り付けて **Run** を実行

> Supabase のプロジェクト URL とキーの確認場所:
> **Settings → API** → `URL`, `anon key`, `service_role key`

---

## ステップ 2 — LINE Developers でログインチャネル作成

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン（無料）
2. **プロバイダーを作成**（または既存を選択）
3. **チャネル作成 → LINEログイン**
4. 基本設定でメモしておくもの:
   - **チャネル ID** → `LINE_CLIENT_ID`
   - **チャネルシークレット** → `LINE_CLIENT_SECRET`
5. **LINEログイン設定** タブ → **コールバックURL** に追加:
   ```
   https://YOUR_APP.vercel.app/api/auth/callback/line
   ```
   > ⚠️ Vercel URL が決まるまで一時的に `https://example.com/api/auth/callback/line` を入力し、デプロイ後に更新してください。
6. **メール取得権限** は不要（LINEユーザーIDのみ使用）

---

## ステップ 3 — GitHub にリポジトリを作成してプッシュ

```bash
cd "Personnel Evaluation/personnel-eval"

# Git 初期化
git init
git add .
git commit -m "initial commit"

# GitHub に新規リポジトリを作成後:
git remote add origin https://github.com/YOUR_GITHUB_ID/YOUR_REPO.git
git push -u origin main
```

---

## ステップ 4 — Vercel にデプロイ

1. [vercel.com](https://vercel.com) → **Add New → Project**
2. GitHub リポジトリをインポート
3. **Framework Preset**: Next.js（自動検出されます）
4. **Environment Variables** に以下を設定:

| 変数名 | 値 | 取得場所 |
|---|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` の出力 | ターミナルで生成 |
| `AUTH_URL` | `https://YOUR_APP.vercel.app` | Vercel のドメイン |
| `LINE_CLIENT_ID` | LINEのチャネルID | LINE Developers |
| `LINE_CLIENT_SECRET` | LINEのチャネルシークレット | LINE Developers |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Supabase → Settings → API |
| `ADMIN_LINE_IDS` | 最初は空でOK（後で設定） | — |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSONキー（後述） | Google Cloud Console |

5. **Deploy** ボタンをクリック → デプロイ完了

> 📌 デプロイ後に **Vercel のドメイン**（例: `https://personnel-eval.vercel.app`）を確認し、
> LINE Developers のコールバックURLを更新してください。

---

## ステップ 5 — Admin アカウントを設定

1. デプロイされた URL にアクセス
2. **LINEでログイン** してアカウントを作成
3. Supabase の **SQL Editor** で以下を実行:

```sql
-- ログインしたあなたの LINE ID を確認
SELECT id, line_id, line_name FROM users;

-- Admin 権限を付与（LINE ID を置き換えてください）
UPDATE users SET role = 'Admin' WHERE line_id = 'YOUR_LINE_ID';

-- 他のユーザー（AM など）も同様に設定
UPDATE users SET role = 'AM', team = '辻利' WHERE line_id = 'AM_LINE_ID';
```

4. Vercel の環境変数に `ADMIN_LINE_IDS` を設定（カンマ区切りで複数可）:
   ```
   U1234567890abcdef
   ```
5. Vercel で **Redeploy** → 次回ログイン以降 Admin が自動付与されます

---

## ステップ 6 — Google Sheets 連携（任意）

スプレッドシートから実績データを取り込む機能です。設定しない場合はモックデータで動作します。

### 6-1. Google Cloud でサービスアカウントを作成

1. [Google Cloud Console](https://console.cloud.google.com/) → プロジェクト作成
2. **APIs & Services → Library** → **Google Sheets API** を有効化
3. **IAM & Admin → Service Accounts → Create Service Account**
   - 名前: `appo-eval-sync`
   - ロール: なし（シートへの共有で制御）
4. 作成後 → **Keys → Add Key → JSON** → ダウンロード

### 6-2. スプレッドシートを共有

- 対象スプレッドシートを開く → 共有 → サービスアカウントのメール（`xxx@yyy.iam.gserviceaccount.com`）を **閲覧者** として追加

### 6-3. 環境変数に設定

ダウンロードしたJSONファイルの内容を1行に変換して Vercel の環境変数に設定:

```bash
# Mac/Linux でJSONを1行に変換
cat downloaded-key.json | tr -d '\n'
```

Vercel の `GOOGLE_SERVICE_ACCOUNT_KEY` に貼り付け → Redeploy

---

## ステップ 7 — GAS で管理者分析シートを設定（任意）

DB のデータを Google スプレッドシートに定期エクスポートする機能です。

1. 分析用の Google スプレッドシートを新規作成
2. **ツール → スクリプトエディタ**
3. `gas/sync_to_sheets.gs` の内容を貼り付け
4. **プロジェクトの設定 → スクリプト プロパティ** に追加:
   - `SUPABASE_URL` : `https://xxxx.supabase.co`
   - `SUPABASE_SERVICE_KEY` : Supabase の service_role key
5. `syncAllToSheets` 関数を手動実行（初回の権限承認が必要）
6. `setupDailyTrigger` 関数を実行 → 毎日 AM 6:00 に自動同期

---

## セキュリティチェックリスト

- [ ] `SUPABASE_SERVICE_ROLE_KEY` は絶対に公開しない（環境変数のみ）
- [ ] Supabase の RLS が全テーブルで有効になっている（schema.sql で設定済み）
- [ ] LINE Developers のコールバックURLが正しい（https のみ）
- [ ] `AUTH_SECRET` はランダムな32文字以上の文字列

---

## トラブルシューティング

| 症状 | 原因・対処 |
|---|---|
| LINEログイン後に「エラー」が出る | コールバックURLが LINE Developers と一致しているか確認 |
| ダッシュボードに進めない | Supabase の schema.sql が実行されているか確認 |
| 同期がモックデータになる | `GOOGLE_SERVICE_ACCOUNT_KEY` が正しく設定されているか確認 |
| Admin 設定に入れない | `users` テーブルで role = 'Admin' になっているか確認 |
| VercelビルドがNGになる | ローカルで `npm run build` でエラーを確認 |
