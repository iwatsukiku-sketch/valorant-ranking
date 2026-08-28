"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/input";

  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "ログインできませんでした");
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setErr("通信できませんでした。電波を確認してください");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1 className="title">スタッフログイン</h1>
      <p className="subtitle">記録の入力・管理にはパスコードが必要です</p>

      {err && <div className="msg err">{err}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="pc">
            パスコード
          </label>
          <input
            id="pc"
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
        </div>
        <button className="btn" type="submit" disabled={busy || !passcode}>
          {busy ? "確認中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <LoginForm />
    </Suspense>
  );
}
