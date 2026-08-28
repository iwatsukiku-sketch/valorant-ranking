import { NextResponse } from "next/server";
import { sqlClient, DIVISIONS, TARGET_KILLS, type RecordRow } from "@/lib/db";

export const dynamic = "force-dynamic";

function isStaff(req: Request): boolean {
  const token = process.env.STAFF_TOKEN;
  if (!token) return false;
  const cookie = req.headers.get("cookie") || "";
  return cookie.split(";").some((c) => c.trim() === `staff=${token}`);
}

/** 一覧取得。ランキング表示から呼ぶので認証なしで読める。 */
export async function GET() {
  try {
    const sql = sqlClient();
    const rows = (await sql`
      SELECT id, nickname, division, finished, time_sec, kills, pc_no, note, created_at
      FROM records
      ORDER BY created_at ASC, id ASC
    `) as unknown as RecordRow[];
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "取得に失敗しました";
    return NextResponse.json({ error: message, rows: [] }, { status: 500 });
  }
}

/** 新規登録。スタッフのみ。 */
export async function POST(req: Request) {
  if (!isStaff(req)) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  let body: {
    nickname?: string;
    division?: string;
    finished?: boolean;
    time_sec?: number | null;
    kills?: number | null;
    pc_no?: string | null;
    note?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const nickname = (body.nickname || "").trim();
  const division = (body.division || "").trim();
  const finished = body.finished === true;

  if (!nickname) {
    return NextResponse.json({ error: "ニックネームを入れてください" }, { status: 400 });
  }
  if (nickname.length > 20) {
    return NextResponse.json({ error: "ニックネームは20文字までです" }, { status: 400 });
  }
  if (!(DIVISIONS as readonly string[]).includes(division)) {
    return NextResponse.json({ error: "部門を選んでください" }, { status: 400 });
  }

  let time_sec: number | null = null;
  let kills: number | null = null;

  if (finished) {
    const t = Number(body.time_sec);
    if (!Number.isFinite(t) || t <= 0) {
      return NextResponse.json({ error: "クリアタイムを入れてください" }, { status: 400 });
    }
    time_sec = Math.round(t * 10) / 10;
  } else {
    const k = Number(body.kills);
    if (!Number.isInteger(k) || k < 0 || k > TARGET_KILLS) {
      return NextResponse.json(
        { error: `撃破数は 0〜${TARGET_KILLS} で入れてください` },
        { status: 400 }
      );
    }
    kills = k;
  }

  try {
    const sql = sqlClient();
    const rows = (await sql`
      INSERT INTO records (nickname, division, finished, time_sec, kills, pc_no, note)
      VALUES (${nickname}, ${division}, ${finished}, ${time_sec}, ${kills},
              ${body.pc_no ?? null}, ${body.note ?? null})
      RETURNING id, nickname, division, finished, time_sec, kills, pc_no, note, created_at
    `) as unknown as RecordRow[];
    return NextResponse.json({ row: rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "登録に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
