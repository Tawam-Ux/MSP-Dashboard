"use client";

import { useActionState } from "react";
import { createUser, type UserFormState } from "./actions";

type Option = { code: string; name: string; level?: number };

export function CreateUserForm({ roles, units }: { roles: Option[]; units: Option[] }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(createUser, {});

  return (
    <form action={action} className="grid max-w-3xl gap-5 sm:grid-cols-2">
      <Input label="ชื่อผู้ใช้" name="username" hint="a-z 0-9 . _ -" autoComplete="off" />
      <Input label="ชื่อที่แสดง" name="name" />
      <Input label="รหัสผ่านเริ่มต้น" name="password" type="password" hint="อย่างน้อย 8 ตัว" autoComplete="new-password" />
      <label className="block">
        <span className="mb-1.5 block text-sm text-ink-2">บทบาท</span>
        <select name="roleCode" required className="w-full rounded-md border border-line-strong bg-surface px-3 py-2">
          {roles.map((r) => (
            <option key={r.code} value={r.code}>{r.name}</option>
          ))}
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm text-ink-2">หน่วยที่ให้เห็น (เห็นสาขาย่อยทั้งหมดของหน่วยที่เลือก)</legend>
        <div className="max-h-64 overflow-y-auto rounded-md border border-line-strong bg-surface p-2 text-sm">
          {units.map((u) => (
            <label key={u.code} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-plane" style={{ paddingLeft: `${(u.level ?? 0) * 1.25 + 0.25}rem` }}>
              <input type="checkbox" name="unitCodes" value={u.code} />
              <span>{u.name}</span>
              <span className="text-xs text-ink-3">{u.code}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-md bg-ink px-4 py-2 font-medium text-plane disabled:opacity-60">
          {pending ? "กำลังสร้าง…" : "สร้างผู้ใช้"}
        </button>
        <p aria-live="polite" className={`text-sm ${state.error ? "text-loss-text" : "text-ink-2"}`}>
          {state.error ?? state.ok}
        </p>
      </div>
    </form>
  );
}

function Input({ label, name, type = "text", hint, autoComplete }: { label: string; name: string; type?: string; hint?: string; autoComplete?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ink-2">
        {label}
        {hint && <span className="ml-2 text-ink-3">{hint}</span>}
      </span>
      <input name={name} type={type} required autoComplete={autoComplete} className="w-full rounded-md border border-line-strong bg-surface px-3 py-2" />
    </label>
  );
}
