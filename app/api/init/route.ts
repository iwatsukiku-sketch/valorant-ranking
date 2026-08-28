import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 初回セットアップ用。ブラウザで /api/init?key=<STAFF_TOKEN> を一度開くと
 * テーブルが作られます。何度実行しても安全です（IF NOT EXISTS）。
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.STAFF_TOKEN || key !== process.env.STAFF_TOKEN) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const sql = sqlClient();
  await sql`
    CREATE TABLE IF NOT EXISTS records (
      id          SERIAL PRIMARY KEY,
      nickname    TEXT        NOT NULL,
      division    TEXT        NOT NULL,
      finished    BOOLEAN     NOT NULL,
      time_sec    NUMERIC(6,1),
      kills       INTEGER,
      pc_no       TEXT,
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS records_division_idx ON records (division)`;
  await sql`CREATE INDEX IF NOT EXISTS records_created_idx ON records (created_at)`;

  return NextResponse.json({ ok: true, message: "テーブルを作成しました" });
}
