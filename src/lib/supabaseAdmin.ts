/**
 * サーバーサイド専用 Supabase クライアント
 * SERVICE_ROLE キーを使用するため RLS をバイパスします
 * クライアントコンポーネントでは絶対に使用しないこと
 *
 * ビルド時に環境変数がなくてもクラッシュしないよう遅延初期化する
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdminClient = SupabaseClient<any, "public", any>;

declare global {
  // eslint-disable-next-line no-var
  var _supabaseAdmin: AdminClient | undefined;
}

/**
 * supabaseAdmin を取得する（遅延初期化）
 * API Route / auth callback 内で呼び出すこと
 */
export function getSupabaseAdmin(): AdminClient {
  if (global._supabaseAdmin) return global._supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません"
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global._supabaseAdmin = createClient<any, "public", any>(url, key, {
    auth: { persistSession: false },
  }) as AdminClient;

  return global._supabaseAdmin;
}

/**
 * 後方互換: `supabaseAdmin` として直接インポートしている箇所向け
 * 実際には関数呼び出しで返す Proxy
 */
export const supabaseAdmin = new Proxy({} as AdminClient, {
  get(_target, prop) {
    return getSupabaseAdmin()[prop as keyof AdminClient];
  },
});
