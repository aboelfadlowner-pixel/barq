"use client";

import { useState } from "react";
import { api, AdminApiError } from "./api";

export function LoginForm({ next, devHint }: { next: string; devHint: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/login", { method: "POST", body: { password } });
      window.location.href = next;
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "حصل خطأ");
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <img src="/images/logo-icon.png" alt="" />
        <h1>لوحة تحكم أبو الفضل</h1>
        <div className="field">
          <label htmlFor="pw">كلمة السر</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          {devHint ? <small className="hint">وضع التجربة: كلمة السر admin (حط ADMIN_PASSWORD في .env.local لتغييرها)</small> : null}
        </div>
        {error ? <div className="alert">{error}</div> : null}
        <button className="btn btn-primary" disabled={busy || !password}>
          {busy ? "جاري الدخول…" : "دخول"}
        </button>
      </form>
    </main>
  );
}
