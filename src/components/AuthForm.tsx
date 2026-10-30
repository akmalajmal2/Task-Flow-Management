"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/app/auth-actions";
import { Logo } from "./Logo";
import { Spinner } from "./ui";

export function AuthForm({ next, email, linkError }: { next: string; email: string; linkError: boolean }) {
  const [mode, setMode] = useState<"in" | "up">(next.startsWith("/invite/") ? "up" : "in");
  const [inState, inAction, inBusy] = useActionState(signIn, {});
  const [upState, upAction, upBusy] = useActionState(signUp, {});
  const state = mode === "in" ? inState : upState;
  const busy = mode === "in" ? inBusy : upBusy;

  return (
    <div className="auth-card">
      <Logo />
      <div>
        <h1>{mode === "in" ? "Sign in to Tasklane" : "Create your account"}</h1>
        {next.startsWith("/invite/") && (
          <p style={{ color: "var(--ink-2)", marginTop: 6 }}>
            You've been invited to a project. {mode === "up" ? "Create an account with the invited address to join." : "Sign in with the invited address to accept."}
          </p>
        )}
      </div>
      {linkError && <p className="form-error">That confirmation link has expired. Sign in or create the account again.</p>}
      <form action={mode === "in" ? inAction : upAction} key={mode}>
        <input type="hidden" name="next" value={next} />
        {mode === "up" && (
          <label className="field">
            <span>Full name</span>
            <input type="text" name="name" required autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Work email</span>
          <input type="email" name="email" required autoComplete="email" defaultValue={email} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" name="password" required minLength={mode === "up" ? 8 : undefined} autoComplete={mode === "in" ? "current-password" : "new-password"} />
          {mode === "up" && <small>At least 8 characters.</small>}
        </label>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.notice && <p className="chip" data-tone="ok" style={{ height: "auto", padding: "8px 10px", whiteSpace: "normal" }}>{state.notice}</p>}
        <button className="btn primary" style={{ height: 38 }} disabled={busy}>
          {busy && <Spinner />} {mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        {mode === "in" ? "New here? " : "Already have an account? "}
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
