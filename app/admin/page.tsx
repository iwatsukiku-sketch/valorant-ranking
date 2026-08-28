"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const DIVISIONS = ["小学生", "中学生", "一般・シニア"] as const;
const TARGET_KILLS = 50;

type Row = {
  id: number;
  nickname: string;
  division: string;
  finished: boolean;
  time_sec: number | string | null;
  kills: number | null;
  pc_no: string | null;
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

function display(r: Row): string {
  if (r.finished) {
    const t = Number(r.time_sec ?? 0);
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m > 0 ? `${m}分${s.toFixed(1)}秒` : `${s.toFixed(1)}秒`;
  }
  return `未完走 ${r.kills ?? 0}体`;
}

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [filter, setFilter] = useState<string>("すべて");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/records", { cache: "no-store" });
      const data = await res.json();
      setRows(data.rows || []);
    } catch {
      setMsg({ kind: "err", text: "取得できませんでした" });
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function save() {
    if (!editing) return;
    const body = {
      nickname: editing.nickname,
      division: editing.division,
      finished: editing.finished,
      time_sec: editing.finished ? Number(editing.time_sec) : null,
      kills: editing.finished ? null : Number(editing.kills),
    };
    const res = await fetch(`/api/records/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ kind: "err", text: data.error || "更新できませんでした" });
      return;
    }
    setMsg({ kind: "ok", text: "更新しました" });
    setEditing(null);
    load();
  }

  async function remove(id: number, name: string) {
    if (!confirm(`「${name}」の記録を削除します。よろしいですか？`)) return;
    const res = await fetch(`/api/records/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMsg({ kind: "ok", text: "削除しました" });
      load();
    } else {
      setMsg({ kind: "err", text: "削除できませんでした" });
    }
  }

  const shown =
    filter === "すべて" ? rows : rows.filter((r) => r.division === filter);
  const ordered = [...shown].sort(compare);

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1 className="title">記録の管理</h1>
      <p className="subtitle">登録 {rows.length} 件　／　8秒ごとに自動更新</p>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <div className="field">
        <span className="label">部門でしぼる</span>
        <div className="choices" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {(["すべて", ...DIVISIONS] as string[]).map((d) => (
            <button
              key={d}
              type="button"
              className="choice"
              style={{ fontSize: 13, height: 48 }}
              aria-pressed={filter === d}
              onClick={() => setFilter(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <div className="card">
          <span className="label">記録を訂正（ID {editing.id}）</span>

          <div className="field">
            <label className="label">ニックネーム</label>
            <input
              className="input"
              value={editing.nickname}
              onChange={(e) => setEditing({ ...editing, nickname: e.target.value })}
            />
          </div>

          <div className="field">
            <span className="label">部門</span>
            <div className="choices">
              {DIVISIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="choice"
                  style={{ fontSize: 13 }}
                  aria-pressed={editing.division === d}
                  onClick={() => setEditing({ ...editing, division: d })}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">結果</span>
            <div className="choices two">
              <button
                type="button"
                className="choice"
                aria-pressed={editing.finished}
                onClick={() => setEditing({ ...editing, finished: true })}
              >
                完走
              </button>
              <button
                type="button"
                className="choice"
                aria-pressed={!editing.finished}
                onClick={() => setEditing({ ...editing, finished: false })}
              >
                未完走
              </button>
            </div>
          </div>

          <div className="field">
            <label className="label">
              {editing.finished ? "クリアタイム（秒／通算）" : `撃破数（0〜${TARGET_KILLS}）`}
            </label>
            <input
              className="input"
              inputMode="decimal"
              value={
                editing.finished
                  ? String(editing.time_sec ?? "")
                  : String(editing.kills ?? "")
              }
              onChange={(e) =>
                setEditing(
                  editing.finished
                    ? { ...editing, time_sec: e.target.value }
                    : { ...editing, kills: Number(e.target.value) }
                )
              }
            />
            {editing.finished && (
              <p className="hint">1分47秒3 なら「107.3」と入れてください</p>
            )}
          </div>

          <div className="row">
            <button className="btn" onClick={save}>
              保存する
            </button>
            <button className="btn ghost" style={{ height: 64 }} onClick={() => setEditing(null)}>
              やめる
            </button>
          </div>
        </div>
      )}

      <div className="card scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>順位</th>
              <th>ニックネーム</th>
              <th>部門</th>
              <th>記録</th>
              <th>PC</th>
              <th>時刻</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.nickname}</td>
                <td>{r.division}</td>
                <td>{display(r)}</td>
                <td>{r.pc_no || "—"}</td>
                <td>
                  {new Date(r.created_at).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  <div className="row">
                    <button
                      className="btn ghost"
                      style={{ width: "auto", padding: "0 10px", height: 36 }}
                      onClick={() => setEditing(r)}
                    >
                      訂正
                    </button>
                    <button
                      className="btn ghost"
                      style={{ width: "auto", padding: "0 10px", height: 36 }}
                      onClick={() => remove(r.id, r.nickname)}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {ordered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--text-dim)", padding: 24 }}>
                  まだ記録がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <a className="btn ghost" href="/api/export" style={{ lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>
          CSVで書き出す（Excelで開けます）
        </a>
        <Link className="btn ghost" href="/input" style={{ lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>
          入力画面へ戻る
        </Link>
      </div>
    </div>
  );
}
