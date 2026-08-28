"use client";

import { useEffect, useRef, useState } from "react";

/** 表示件数（下絵どおり TOP20） */
const TOP_N = 20;
const PODIUM_N = 5; // 1〜5位は表彰台カード
const LEFT_ROWS = 7; // 6〜12位
const RIGHT_ROWS = 8; // 13〜20位
const POLL_MS = 3000;

type Row = {
  id: number;
  nickname: string;
  division: string;
  finished: boolean;
  time_sec: number | string | null;
  kills: number | null;
  created_at: string;
};

function sortKey(r: Row): number {
  if (r.finished) return Number(r.time_sec ?? 9999);
  return 10000 - Number(r.kills ?? 0);
}

function compare(a: Row, b: Row): number {
  const d = sortKey(a) - sortKey(b);
  if (d !== 0) return d;
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  if (ta !== tb) return ta - tb;
  return a.id - b.id;
}

/** 完走 → 1:02.4 ／ 未完走 → 32体 */
function display(r: Row): string {
  if (r.finished) {
    const t = Number(r.time_sec ?? 0);
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m > 0 ? `${m}:${s.toFixed(1).padStart(4, "0")}` : `${s.toFixed(1)}`;
  }
  return `${r.kills ?? 0}体`;
}

function Crown() {
  return (
    <svg className="crown" viewBox="0 0 64 36" aria-hidden>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3c0" />
          <stop offset="45%" stopColor="#ffd24a" />
          <stop offset="100%" stopColor="#b57f0a" />
        </linearGradient>
      </defs>
      <path
        d="M4 30 L2 8 L18 18 L32 3 L46 18 L62 8 L60 30 Z"
        fill="url(#cg)"
        stroke="#7a5405"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="4" y="29" width="56" height="5" rx="1.5" fill="url(#cg)" stroke="#7a5405" strokeWidth="1.2" />
    </svg>
  );
}

function Clock({ color = "#e0281f" }: { color?: string }) {
  return (
    <svg className="clock" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="13" r="8.4" fill="none" stroke={color} strokeWidth="2.2" />
      <path d="M12 8.6 V13 L15 15" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.4 2.6 h5.2" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 2.6 V4.6" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function RankingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [scale, setScale] = useState(1);
  const [offline, setOffline] = useState(false);
  const newIds = useRef<Set<number>>(new Set());
  const knownIds = useRef<Set<number>>(new Set());
  const firstLoad = useRef(true);
  const [, forceTick] = useState(0);

  // 1920×1080 の板を、画面いっぱいに収まるよう拡大縮小する
  useEffect(() => {
    function fit() {
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/records", { cache: "no-store" });
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as { rows: Row[] };
        if (!alive) return;

        if (!firstLoad.current) {
          const fresh = data.rows.map((r) => r.id).filter((id) => !knownIds.current.has(id));
          fresh.forEach((id) => newIds.current.add(id));
          if (fresh.length > 0) {
            setTimeout(() => {
              fresh.forEach((id) => newIds.current.delete(id));
              forceTick((n) => n + 1);
            }, 2200);
          }
        }
        data.rows.forEach((r) => knownIds.current.add(r.id));
        firstLoad.current = false;

        setRows(data.rows);
        setOffline(false);
      } catch {
        if (alive) setOffline(true);
      }
    }

    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const ordered = [...rows].sort(compare);
  const top = ordered.slice(0, TOP_N);

  // 最新タイム＝いちばん最後に登録された記録
  const latest =
    rows.length > 0
      ? [...rows].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id - a.id
        )[0]
      : null;

  /** 名前の長さに応じて文字サイズを段階的に落とす（表彰台のみ） */
  function nameSizeClass(name: string): string {
    const n = name.length;
    if (n <= 4) return "nm-s1";
    if (n <= 6) return "nm-s2";
    if (n <= 9) return "nm-s3";
    return "nm-s4";
  }

  function podium(i: number) {
    const r = top[i];
    const cls = `pod p${i + 1}${r ? "" : " empty"}${
      r && newIds.current.has(r.id) ? " is-new" : ""
    }`;
    return (
      <div className={cls} key={i}>
        {i < 3 && <Crown />}
        <div className="no">{i + 1}</div>
        <div className="body">
          <div className={`namebox ${nameSizeClass(r ? r.nickname : "—")}`}>
            {r ? r.nickname : "—"}
          </div>
          <div className="timerow">
            <Clock color={i === 0 ? "#8a6206" : i === 1 ? "#4a5158" : "#8a3a08"} />
            <div className={`timebox${r && !r.finished ? " dnf" : ""}`}>
              {r ? display(r) : "—"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function tableRow(rank: number) {
    const r = top[rank - 1];
    return (
      <div
        className={`tbl-row${r ? "" : " empty"}${
          r && newIds.current.has(r.id) ? " is-new" : ""
        }`}
        key={rank}
      >
        <div className="no">{rank}</div>
        <div className="nm">{r ? r.nickname : "—"}</div>
        <div className="tm">
          <Clock />
          <span>{r ? display(r) : "—"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-wrap">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {/* ヘッダー */}
        <header className="hd">
          <div className="hd-brand">
            <span className="en">VALORANT</span>
            <span className="jp">射撃体験会</span>
          </div>
          <div className="hd-main">
            <span className="hd-50">50体排除</span>
            <span className="hd-ta">タイムアタック</span>
          </div>
          <div className="hd-top20">ランキング TOP {TOP_N}</div>
          <div className="hd-gift">
            上位入賞者には
            <br />
            プレゼント！
          </div>
        </header>

        {/* 1〜5位 */}
        <section className="podium">
          {Array.from({ length: PODIUM_N }).map((_, i) => podium(i))}
        </section>

        {/* 6〜20位 */}
        <section className="tables">
          <div className="tbl">
            <div className="tbl-head">
              <div>順位</div>
              <div>プレイヤー名</div>
              <div>タイム</div>
            </div>
            {Array.from({ length: LEFT_ROWS }).map((_, i) => tableRow(PODIUM_N + 1 + i))}
          </div>
          <div className="tbl">
            <div className="tbl-head">
              <div>順位</div>
              <div>プレイヤー名</div>
              <div>タイム</div>
            </div>
            {Array.from({ length: RIGHT_ROWS }).map((_, i) =>
              tableRow(PODIUM_N + LEFT_ROWS + 1 + i)
            )}
          </div>
        </section>

        {/* フッター */}
        <footer className="ft">
          <div className="ft-stats">
            <span className="k">チャレンジ人数</span>
            <span className="v">{rows.length}</span>
            <span className="u">人</span>
            <span className="k">最新タイム</span>
            <span className="v">{latest ? display(latest) : "—"}</span>
            <span className="u">{latest && !latest.finished ? "" : "秒"}</span>
          </div>
          <div className="ft-cta">最速記録に挑戦しよう！</div>
        </footer>

        {offline && <div className="ft-offline">通信が切れています</div>}
      </div>
    </div>
  );
}
