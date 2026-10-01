"use client";

import { useState } from "react";
import { formatBaht } from "@/lib/format";

export type Segment = { key: string; label: string; amount: number; color: string };

/**
 * แถบเงิน 100 บาท: แบ่งรายได้เป็นต้นทุน ค่าใช้จ่าย และกำไร
 * ถ้าขาดทุน ค่าใช้จ่ายรวมจะยาวเกินเส้นรายได้ (100 บาท) และส่วนเกินคือขาดทุน
 */
export function BahtBar({ revenue, segments }: { revenue: number; segments: Segment[] }) {
  const [active, setActive] = useState<string | null>(null);
  const positive = segments.map((s) => ({ ...s, width: Math.max(s.amount, 0) }));
  const span = Math.max(revenue, positive.reduce((t, s) => t + s.width, 0));
  const revenueMark = (revenue / span) * 100;
  const per100 = (n: number) => (n / revenue) * 100;
  const current = positive.find((s) => s.key === active);

  return (
    <figure className="mt-6">
      <div className="relative">
        <div className="flex h-12 gap-0.5" role="list" aria-label="สัดส่วนของรายได้ทุก 100 บาท">
          {positive
            .filter((s) => s.width > 0)
            .map((s) => (
              <div
                key={s.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${s.label} ${per100(s.amount).toFixed(1)} บาท ต่อรายได้ 100 บาท`}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(s.key)}
                onBlur={() => setActive(null)}
                className="first:rounded-l last:rounded-r"
                style={{
                  width: `${(s.width / span) * 100}%`,
                  minWidth: 3,
                  background: s.color,
                  opacity: active && active !== s.key ? 0.45 : 1,
                }}
              />
            ))}
        </div>
        {revenueMark < 99.9 && (
          <div className="pointer-events-none absolute -top-2 -bottom-2 border-l-2 border-ink" style={{ left: `${revenueMark}%` }}>
            <span className="absolute -top-6 -translate-x-1/2 text-xs whitespace-nowrap text-ink-2">รายได้ 100 บาท</span>
          </div>
        )}
        {current && (
          <div
            role="status"
            className="pointer-events-none absolute top-14 z-10 rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-sm"
            style={{ left: `${Math.min(positive.slice(0, positive.indexOf(current)).reduce((t, s) => t + s.width, 0) / span * 100, 70)}%` }}
          >
            <div className="font-medium">{current.label}</div>
            <div className="num text-ink-2">
              {formatBaht(current.amount)} บาท ({per100(current.amount).toFixed(1)} ต่อ 100)
            </div>
          </div>
        )}
      </div>
      <figcaption className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-start gap-2">
            <span className="mt-1.5 size-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <div>
              <div className="text-sm text-ink-2">{s.label}</div>
              <div className={`num font-medium ${s.amount < 0 ? "text-loss-text" : ""}`}>
                {per100(s.amount).toFixed(1)} <span className="text-sm font-normal text-ink-3">บาท</span>
              </div>
            </div>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
