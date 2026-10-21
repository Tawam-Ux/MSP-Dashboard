"use client";

import { useState } from "react";
import { formatBaht } from "@/backend/lib/format";

export type Segment = { key: string; label: string; amount: number; color: string };

/** ปัดเป็นจำนวนเต็มแบบเศษเหลือมากสุด: ผลรวมของเหรียญเท่ากับยอดรวมที่ปัดแล้วพอดี */
function toCoins(values: number[]): number[] {
  const total = Math.round(values.reduce((t, v) => t + v, 0));
  const floors = values.map(Math.floor);
  let left = total - floors.reduce((t, v) => t + v, 0);
  const order = values.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors;
}

/**
 * เหรียญ 100 บาท: รายได้ทุก 100 บาทวาดเป็นเหรียญกลม 100 เหรียญ เหรียญละ 1 บาท ระบายสีตามว่าไปเป็นต้นทุนหรือกำไร
 * ส่วนเล็กๆ ยังเห็นเป็นเหรียญเต็มเม็ด (ไม่กลายเป็นเส้นบางเหมือนแถบ)
 * ถ้าขาดทุน ต้นทุนรวมเกิน 100 เหรียญ — เหรียญที่เกินมีขอบแดง คือส่วนที่ขาดทุน
 */
export function BahtBar({ revenue, segments }: { revenue: number; segments: Segment[] }) {
  const [active, setActive] = useState<string | null>(null);
  const per100 = (n: number) => (n / revenue) * 100;
  const spend = segments.filter((s) => s.amount > 0);
  const counts = toCoins(spend.map((s) => per100(s.amount)));
  const coins = spend.flatMap((s, i) => Array.from({ length: counts[i] }, () => s));
  const over = Math.max(0, coins.length - 100);

  return (
    <figure className="mt-2">
      <div
        className="coins"
        role="img"
        aria-label={`รายได้ทุก 100 บาท: ${spend.map((s) => `${s.label} ${per100(s.amount).toFixed(1)} บาท`).join(", ")}${over ? ` · ใช้เกินรายได้ ${over} บาท` : ""}`}
      >
        {coins.map((s, n) => (
          <span
            key={n}
            className="coin"
            data-over={n >= 100 || undefined}
            data-dim={(active && active !== s.key) || undefined}
            style={{ background: s.color, "--n": n } as React.CSSProperties}
          />
        ))}
      </div>
      {over > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[0.8125rem] text-loss-text">
          <span aria-hidden className="size-3 rounded-full bg-surface ring-2 ring-loss" />
          เหรียญขอบแดง {over} เหรียญ = ใช้เกินรายได้ คือส่วนที่ขาดทุน
        </p>
      )}
      {/* รายการแนวตั้ง ชื่อซ้าย ตัวเลขชิดขวา · ชี้/โฟกัสแถวเพื่อไฮไลต์เหรียญของหมวดนั้น */}
      <figcaption className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {segments.map((s) => (
          <div
            key={s.key}
            tabIndex={s.amount > 0 ? 0 : undefined}
            onMouseEnter={() => s.amount > 0 && setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => s.amount > 0 && setActive(s.key)}
            onBlur={() => setActive(null)}
            title={`${s.label} ${formatBaht(s.amount)} บาท`}
            className={`-mx-2 flex items-center gap-2.5 rounded-full px-2 py-2 text-sm transition-colors duration-150 ${active === s.key ? "bg-surface-2" : ""}`}
          >
            <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 text-ink-2">{s.label}</span>
            <span className={`num font-semibold ${s.amount < 0 ? "text-loss-text" : ""}`}>
              {per100(s.amount).toFixed(1)} <span className="font-normal text-ink-3">บาท</span>
            </span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
