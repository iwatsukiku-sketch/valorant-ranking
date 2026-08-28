import { NextResponse } from "next/server";
import { sqlClient, DIVISIONS, TARGET_KILLS, type RecordRow } from "@/lib/db";

export const dynamic = "force-dynamic";

function isStaff(req: Request): boolean {
  const token = process.env.STAFF_TOKEN;
  if (!token) return false;
  const cookie = req.headers.get("cookie") || "";
  return cookie.split(";").some((c) => c.trim() === `staff=${token}`);
}

type Ctx = { params: Promise<{ id: string }> };

/** 訂正 */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!isStaff(req)) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const rid = Number(id);
  if (!Number.isInteger(rid)) {
    return NextResponse.json({ error: "IDが不正です" }, { status: 400 });
  }

  const body = (await req.json()) as {
    nickname?: string;
    division?: string;
    finished?: boolean;
    time_sec?: number | null;
    kills?: number | null;
  };

  const nickname = (body.nickname || "").trim();
  const division = (body.division || "").trim();
  const finished = body.finished === true;

  if (!nickname) {
    return NextResponse.json({ error: "ニックネームを入れてください" }, { status: 400 });
  }
  if (!(DIVISIONS as readonly string[]).includes(division)) {
    return NextResponse.json({ error: "部門が不正です" }, { status: 400 });
  }

  let time_sec: number | null = null;
  let kills: number | null = null;
  if (finished) {
    const t = Number(body.time_sec);
    if (!Number.isFinite(t) || t <= 0) {
      return NextResponse.json({ error: "クリアタイムが不正です" }, { status: 400 });
    }
    time_sec = Math.round(t * 10) / 10;
  } else {
    const k = Number(body.kills);
    if (!Number.isInteger(k) || k < 0 || k > TARGET_KILLS) {
      return NextResponse.json({ error: "撃破数が不正です" }, { status: 400 });
    }
    kills = k;
  }

  try {
    const sql = sqlClient();
    const rows = (await sql`
      UPDATE records
         SET nickname = ${nickname},
             division = ${division},
             finished = ${finished},
             time_sec = ${time_sec},
             kills    = ${kills}
       WHERE id = ${rid}
      RETURNING id, nickname, division, finished, time_sec, kills, pc_no, note, created_at
    `) as unknown as RecordRow[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ row: rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 削除 */
export async function DELETE(req: Request, ctx: Ctx) {
  if (!isStaff(req)) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const rid = Number(id);
  if (!Number.isInteger(rid)) {
    return NextResponse.json({ error: "IDが不正です" }, { status: 400 });
  }
  try {
    const sql = sqlClient();
    await sql`DELETE FROM records WHERE id = ${rid}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
