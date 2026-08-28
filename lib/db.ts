import { neon } from "@neondatabase/serverless";

/**
 * Neon (Vercel Marketplace) の接続文字列。
 * Vercel の Neon 統合は DATABASE_URL を注入します。
 * 旧 Vercel Postgres からの移行環境では POSTGRES_URL が残っている場合があるため、
 * どちらでも動くようにしています。
 */
function connectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL が設定されていません。Vercel の Storage で Neon を接続してください。"
    );
  }
  return url;
}

export function sqlClient() {
  return neon(connectionString());
}

export const DIVISIONS = ["小学生", "中学生", "一般・シニア"] as const;
export type Division = (typeof DIVISIONS)[number];

export type RecordRow = {
  id: number;
  nickname: string;
  division: Division;
  finished: boolean;
  time_sec: number | null;
  kills: number | null;
  pc_no: string | null;
  note: string | null;
  created_at: string;
};

/** 上限時間（秒）。ルール：2分 */
export const TIME_LIMIT_SEC = 120;

/** 目標撃破数 */
export const TARGET_KILLS = 50;
