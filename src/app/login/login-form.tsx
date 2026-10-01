"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-5">
      <Field label="ชื่อผู้ใช้" name="username" autoComplete="username" />
      <Field label="รหัสผ่าน" name="password" type="password" autoComplete="current-password" />
      {state.error && (
        <p role="alert" className="text-sm text-loss-text">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-ink px-4 py-2.5 font-medium text-plane disabled:opacity-60"
      >
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}

function Field({ label, name, type = "text", autoComplete }: { label: string; name: string; type?: string; autoComplete: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ink-2">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-ink"
      />
    </label>
  );
}
