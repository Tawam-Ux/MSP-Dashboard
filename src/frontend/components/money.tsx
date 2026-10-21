"use client";

import { createContext, useContext, useState } from "react";
import { MONEY_COOKIE, formatMoney, type MoneyMode } from "@/backend/lib/format";

const MoneyContext = createContext<{ mode: MoneyMode; setMode: (m: MoneyMode) => void }>({ mode: "full", setMode: () => {} });

export function MoneyProvider({ initial, children }: { initial: MoneyMode; children: React.ReactNode }) {
  const [mode, setModeState] = useState<MoneyMode>(initial);
  const setMode = (m: MoneyMode) => {
    setModeState(m);
    document.cookie = `${MONEY_COOKIE}=${m}; path=/; max-age=31536000; samesite=lax`;
  };
  // data-money ให้ CSS รู้รูปแบบที่เลือก (เช่น ตารางรายเดือนกว้างคอลัมน์ตามแบบทศนิยม) · display: contents ไม่กระทบ layout
  return (
    <MoneyContext.Provider value={{ mode, setMode }}>
      <div data-money={mode} className="contents">{children}</div>
    </MoneyContext.Provider>
  );
}

/** ทุกรูปแบบเป็นหน่วยบาท (แบบย่อมี K/M ในตัวเลขเอง) — unit/unitLong คงไว้ให้หน้าที่เรียกใช้อยู่แล้ว */
export function useMoney() {
  const { mode } = useContext(MoneyContext);
  return {
    mode,
    fmt: (n: number) => formatMoney(n, mode),
    unit: "บาท",
    unitLong: "บาท",
  };
}

/**
 * แสดงจำนวนเงินตามรูปแบบที่ผู้ใช้เลือก
 * unit: "none" = ตัวเลขอย่างเดียว, "short" / "long" = ต่อท้ายด้วย "บาท"
 */
export function Money({ value, unit = "none", minus = false }: { value: number; unit?: "none" | "short" | "long"; minus?: boolean }) {
  const m = useMoney();
  const label = unit === "short" ? m.unit : unit === "long" ? m.unitLong : null;
  return (
    <span className="money-roll" key={m.mode}>
      {minus ? "−" : ""}
      {m.fmt(value)}
      {label && ` ${label}`}
    </span>
  );
}

/** ยอดเงินที่ติดลบแสดงด้วยเครื่องหมายลบจริง (−) แทนขีด (-) */
export function SignedMoney({ value, unit = "none" }: { value: number; unit?: "none" | "short" | "long" }) {
  return <Money value={Math.abs(value)} minus={value < 0} unit={unit} />;
}

/** หน่วยอย่างเดียว เช่น หัวตาราง "รายได้ (บาท)" */
export function MoneyUnit({ long = false }: { long?: boolean }) {
  const m = useMoney();
  return <>{long ? m.unitLong : m.unit}</>;
}

const OPTIONS: { key: MoneyMode; label: string; hint: string }[] = [
  { key: "full", label: "ปกติ", hint: "ตัวเลขเต็ม ไม่มีทศนิยม เช่น 1,234,568" },
  { key: "decimal", label: "ทศนิยม", hint: "ทศนิยม 2 ตำแหน่ง เช่น 1,234,567.89" },
  { key: "compact", label: "ย่อ K/M", hint: "แบบย่อ เช่น 1.23M · 45.6K" },
];

export function MoneyToggle() {
  const { mode, setMode } = useContext(MoneyContext);
  return (
    <div className="seg" role="group" aria-label="รูปแบบตัวเลข">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setMode(o.key)}
          title={o.hint}
          aria-label={`${o.label}: ${o.hint}`}
          aria-current={mode === o.key ? "true" : undefined}
          aria-pressed={mode === o.key}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
