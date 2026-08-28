import type { RecordRow } from "./db";

/**
 * 順位ルール（xlsx 版と同一）
 *  1. 完走者（50体撃破）はクリアタイムの短い順に上位
 *  2. 未完走者は完走者の下に、倒した体数の多い順
 *  3. 同記録は先に挑戦した人が上位（登録が早い順）
 *
 * ソートキー：完走 → タイム秒 ／ 未完走 → 10000 - 撃破数
 * これで必ず「完走者 < 未完走者」になる。
 */
export function sortKey(r: RecordRow): number {
  if (r.finished) return Number(r.time_sec ?? 9999);
  return 10000 - Number(r.kills ?? 0);
}

export function compareRecords(a: RecordRow, b: RecordRow): number {
  const d = sortKey(a) - sortKey(b);
  if (d !== 0) return d;
  // 同記録は登録が早いほうを上位に
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  if (ta !== tb) return ta - tb;
  return a.id - b.id;
}

export type Ranked = RecordRow & { rank: number; display: string };

/** 記録の表示文字列 */
export function displayRecord(r: RecordRow): string {
  if (r.finished) {
    const t = Number(r.time_sec ?? 0);
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m > 0
      ? `${m}:${s.toFixed(1).padStart(4, "0")}`
      : `${s.toFixed(1)}秒`;
  }
  return `${r.kills ?? 0}体`;
}

/** 与えられた行を順位づけして返す */
export function rankRecords(rows: RecordRow[]): Ranked[] {
  return [...rows]
    .sort(compareRecords)
    .map((r, i) => ({ ...r, rank: i + 1, display: displayRecord(r) }));
}

/** 部門ごとに順位づけ */
export function rankByDivision(
  rows: RecordRow[],
  division: string
): Ranked[] {
  return rankRecords(rows.filter((r) => r.division === division));
}

export type Summary = {
  total: number;
  finishedCount: number;
  unfinishedCount: number;
  fastest: string;
};

export function summarize(rows: RecordRow[]): Summary {
  const fin = rows.filter((r) => r.finished);
  const times = fin
    .map((r) => Number(r.time_sec ?? NaN))
    .filter((n) => !Number.isNaN(n));
  const fastest =
    times.length > 0
      ? displayRecord({
          ...fin[0],
          finished: true,
          time_sec: Math.min(...times),
        })
      : "—";
  return {
    total: rows.length,
    finishedCount: fin.length,
    unfinishedCount: rows.length - fin.length,
    fastest,
  };
}
