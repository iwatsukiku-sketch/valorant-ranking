import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { passcode } = (await req.json()) as { passcode?: string };

  const expected = process.env.STAFF_PASSCODE;
  const token = process.env.STAFF_TOKEN;

  if (!expected || !token) {
    return NextResponse.json(
      { error: "サーバー側の設定が未完了です（STAFF_PASSCODE / STAFF_TOKEN）" },
      { status: 500 }
    );
  }

  if (passcode !== expected) {
    return NextResponse.json({ error: "パスコードが違います" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("staff", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24時間（イベント当日いっぱい）
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("staff", "", { path: "/", maxAge: 0 });
  return res;
}
