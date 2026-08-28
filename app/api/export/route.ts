import { sqlClient, DIVISIONS, type RecordRow } from "@/lib/db";
import { rankByDivision, displayRecord } from "@/lib/ranking";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isStaff(req: Request): boolean {
  const token = process.env.STAFF_TOKEN;
  if (!token) return false;
  const cookie = req.headers.get("cookie") || "";
  return cookie.split(";").some((c) => c.trim() === `staff=${token}`);
}

/** Excel で開ける CSV（BOM 付き UTF-8）を書き出す */
export async function GET(req: Request) {
  if (!isStaff(req)) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const sql = sqlClient();
  const rows = (await sql`
    SELECT id, nickname, division, finished, time_sec, kills, pc_no, note, created_at
    FROM records ORDER BY created_at ASC, id ASC
  `) as unknown as RecordRow[];

  const header = [
    "部門内順位",
    "部門",
    "ニックネーム",
    "完走",
    "クリアタイム(秒)",
    "撃破数",
    "記録表示",
    "PC番号",
    "登録時刻",
    "備考（連絡先・氏名など）",
  ];

  const lines: string[] = [header.join(",")];

  for (const d of DIVISIONS) {
    for (const r of rankByDivision(rows, d)) {
      lines.push(
        [
          r.rank,
          r.division,
          r.nickname,
          r.finished ? "○" : "×",
          r.time_sec ?? "",
          r.kills ?? "",
          displayRecord(r),
          r.pc_no ?? "",
          new Date(r.created_at).toLocaleString("ja-JP"),
          r.note ?? "",
        ]
          .map((v) => {
            const s = String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      );
    }
  }

  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="valorant_records.csv"`,
    },
  });
}
