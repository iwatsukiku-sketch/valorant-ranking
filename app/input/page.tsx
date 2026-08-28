"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const DIVISIONS = ["小学生", "中学生", "一般・シニア"] as const;
type Division = (typeof DIVISIONS)[number];

const TIME_LIMIT_SEC = 120;
const TARGET_KILLS = 50;
const QUEUE_KEY = "valo_pending_records";

type Payload = {
  nickname: string;
  division: Division;
  finished: boolean;
  time_sec: number | null;
  kills: number | null;
  pc_no: string | null;
};

type Recent = {
  id: number | null; // 未送信は null
  nickname: string;
  division: string;
  text: string;
};

function readQueue(): Payload[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as Payload[];
  } catch {
    return [];
  }
}

function writeQueue(q: Payload[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* 保存できなくても致命的ではない */
  }
}

export default function InputPage() {
  const [pcNo, setPcNo] = useState("");
  const [nickname, setNickname] = useState("");
  const [division, setDivision] = useState<Division | "">("");
  const [finished, setFinished] = useState<boolean | null>(null);
  const [min, setMin] = useState<number>(0);
  const [sec, setSec] = useState("");
  const [kills, setKills] = useState("");

  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [pending, setPending] = useState(0);

  // PC番号は端末に覚えさせる（毎回入れ直さなくてよい）
  useEffect(() => {
    const saved = localStorage.getItem("valo_pc_no");
    if (saved) setPcNo(saved);
    setPending(readQueue().length);
  }, []);

  useEffect(() => {
    if (pcNo) localStorage.setItem("valo_pc_no", pcNo);
  }, [pcNo]);

  /** 未送信キューをまとめて送る */
  const flushQueue = useCallback(async () => {
    const q = readQueue();
    if (q.length === 0) return;
    const remaining: Payload[] = [];
    for (const item of q) {
      try {
        const res = await fetch("/api/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (!res.ok) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    writeQueue(remaining);
    setPending(remaining.length);
    if (q.length > remaining.length) {
      setMsg({
        kind: "ok",
        text: `未送信だった ${q.length - remaining.length} 件を送信しました`,
      });
    }
  }, []);

  useEffect(() => {
    const t = setInterval(flushQueue, 10000);
    window.addEventListener("online", flushQueue);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", flushQueue);
    };
  }, [flushQueue]);

  function reset() {
    setNickname("");
    setFinished(null);
    setMin(0);
    setSec("");
    setKills("");
    // 部門は続けて同じことが多いので残す
  }

  function buildPayload(): { payload?: Payload; error?: string } {
    if (!nickname.trim()) return { error: "ニックネームを入れてください" };
    if (!division) return { error: "部門を選んでください" };
    if (finished === null) return { error: "完走したかどうかを選んでください" };

    if (finished) {
      const s = Number(sec);
      if (!Number.isFinite(s) || s < 0 || s >= 60) {
        return { error: "秒は 0〜59.9 で入れてください" };
      }
      const total = Math.round((min * 60 + s) * 10) / 10;
      if (total <= 0) return { error: "クリアタイムを入れてください" };
      return {
        payload: {
          nickname: nickname.trim(),
          division,
          finished: true,
          time_sec: total,
          kills: null,
          pc_no: pcNo || null,
        },
      };
    }

    const k = Number(kills);
    if (!Number.isInteger(k) || k < 0 || k > TARGET_KILLS) {
      return { error: `撃破数は 0〜${TARGET_KILLS} で入れてください` };
    }
    return {
      payload: {
        nickname: nickname.trim(),
        division,
        finished: false,
        time_sec: null,
        kills: k,
        pc_no: pcNo || null,
      },
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const { payload, error } = buildPayload();
    if (error || !payload) {
      setMsg({ kind: "err", text: error || "入力を確認してください" });
      return;
    }

    const label = payload.finished
      ? `${Math.floor((payload.time_sec ?? 0) / 60)}:${((payload.time_sec ?? 0) % 60)
          .toFixed(1)
          .padStart(4, "0")}`
      : `未完走 ${payload.kills}体`;

    setBusy(true);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error || "登録できませんでした" });
        setBusy(false);
        return;
      }
      setRecent((r) =>
        [
          { id: data.row.id as number, nickname: payload.nickname, division: payload.division, text: label },
          ...r,
        ].slice(0, 8)
      );
      setMsg({ kind: "ok", text: `${payload.nickname} さんの記録を登録しました（${label}）` });
      reset();
      flushQueue();
    } catch {
      // 圏外・テザリング切れ。端末に貯めて後で送る
      const q = readQueue();
      q.push(payload);
      writeQueue(q);
      setPending(q.length);
      setRecent((r) =>
        [{ id: null, nickname: payload.nickname, division: payload.division, text: label }, ...r].slice(0, 8)
      );
      setMsg({
        kind: "warn",
        text: "電波が届かないので端末に保存しました。つながり次第、自動で送信します",
      });
      reset();
    }
    setBusy(false);
  }

  async function remove(id: number | null) {
    if (id === null) return;
    if (!confirm("この記録を取り消しますか？")) return;
    try {
      const res = await fetch(`/api/records/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecent((r) => r.filter((x) => x.id !== id));
        setMsg({ kind: "ok", text: "取り消しました" });
      } else {
        setMsg({ kind: "err", text: "取り消せませんでした" });
      }
    } catch {
      setMsg({ kind: "err", text: "通信できませんでした" });
    }
  }

  const overLimit =
    finished === true && Math.round((min * 60 + Number(sec || 0)) * 10) / 10 > TIME_LIMIT_SEC;

  return (
    <div className="page">
      <h1 className="title">記録入力</h1>
      <p className="subtitle">
        50体排除タイムアタック　／　上限 2分
        {pending > 0 && ` ／ 未送信 ${pending}件`}
      </p>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="pcno">
            PC番号（この端末に記憶されます）
          </label>
          <input
            id="pcno"
            className="input"
            value={pcNo}
            onChange={(e) => setPcNo(e.target.value)}
            placeholder="例：3"
            inputMode="numeric"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="nick">
            ニックネーム
          </label>
          <input
            id="nick"
            className="input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="掲示に出る名前"
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
                aria-pressed={division === d}
                onClick={() => setDivision(d)}
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
              aria-pressed={finished === true}
              onClick={() => setFinished(true)}
            >
              完走（50体）
            </button>
            <button
              type="button"
              className="choice"
              aria-pressed={finished === false}
              onClick={() => setFinished(false)}
            >
              未完走（2分）
            </button>
          </div>
        </div>

        {finished === true && (
          <div className="field">
            <span className="label">クリアタイム</span>
            <div className="choices" style={{ marginBottom: 8 }}>
              {[0, 1, 2].map((m) => (
                <button
                  key={m}
                  type="button"
                  className="choice"
                  aria-pressed={min === m}
                  onClick={() => setMin(m)}
                >
                  {m} 分
                </button>
              ))}
            </div>
            <input
              className="input"
              value={sec}
              onChange={(e) => setSec(e.target.value)}
              inputMode="decimal"
              placeholder="秒（例：47.3）"
            />
            <p className="hint">
              ストップウォッチが「1分47秒3」なら、1分を選んで「47.3」と入れてください
            </p>
            {overLimit && (
              <div className="msg warn" style={{ marginTop: 10 }}>
                2分を超えています。未完走で登録すべきではありませんか？
              </div>
            )}
          </div>
        )}

        {finished === false && (
          <div className="field">
            <label className="label" htmlFor="kills">
              倒した体数
            </label>
            <input
              id="kills"
              className="input"
              value={kills}
              onChange={(e) => setKills(e.target.value)}
              inputMode="numeric"
              placeholder="例：32"
            />
            <p className="hint">0〜{TARGET_KILLS} の整数で入れてください</p>
          </div>
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "送信中…" : "登録する"}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <span className="label">この端末で登録した記録</span>
          <ul className="recent">
            {recent.map((r, i) => (
              <li key={`${r.id ?? "q"}-${i}`}>
                <span>
                  <span className="name">{r.nickname}</span>
                  <span className="meta">
                    {"　"}
                    {r.division}／{r.text}
                    {r.id === null && "（未送信）"}
                  </span>
                </span>
                {r.id !== null && (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ width: "auto", padding: "0 14px" }}
                    onClick={() => remove(r.id)}
                  >
                    取消
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 24, display: "grid", gap: 8 }}>
        <Link className="btn ghost" href="/ranking" style={{ lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>
          ランキングを見る
        </Link>
        <Link className="btn ghost" href="/admin" style={{ lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>
          記録を管理する
        </Link>
      </div>
    </div>
  );
}
