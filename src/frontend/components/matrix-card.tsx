"use client";

import { useState } from "react";
import { MATRIX_SHOW_COOKIE, type MatrixShow } from "@/backend/lib/format";

const OPTIONS: { key: MatrixShow; label: string }[] = [
  { key: "amount", label: "ยอดเงิน" },
  { key: "pct", label: "% ของรายได้" },
];

function remember(s: MatrixShow) {
  document.cookie = `${MATRIX_SHOW_COOKIE}=${s}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * ไฮไลต์คอลัมน์ที่ชี้: ติด data-hcol ให้ทุกช่องในคอลัมน์นั้น (รวมหัวคอลัมน์) และถอดออกจากคอลัมน์เดิม
 * ทำเฉพาะตอนเปลี่ยนคอลัมน์ — เบราว์เซอร์คำนวณสไตล์ใหม่แค่ช่องของสองคอลัมน์นี้ ไม่ใช่ทั้งตาราง (:has() หรือ attribute บนตารางช้ากว่ามาก)
 * ชื่อรายการ (ลูกที่ 1) และแถวหัวข้อ (มีแค่ลูกที่ 1) จึงไม่ถูกไฮไลต์
 */
function markColumn(root: Element, target: EventTarget | null) {
  const table = root.querySelector<HTMLElement>(".matrix");
  if (!table) return;
  const cell = target instanceof Element ? target.closest("tbody td") : null;
  const col = cell instanceof HTMLTableCellElement ? String(cell.cellIndex + 1) : "";
  const was = table.dataset.col ?? "";
  if (was === col) return;
  const cells = (n: string) => table.querySelectorAll(`tr > :nth-child(${n})`);
  if (was) for (const c of cells(was)) c.removeAttribute("data-hcol");
  if (col) for (const c of cells(col)) c.setAttribute("data-hcol", "");
  table.dataset.col = col;
}

/**
 * การ์ดงบรายเดือน: สลับยอดเงิน / % ของรายได้ทันทีในเบราว์เซอร์ (ตารางมีทั้งสองค่าอยู่แล้ว ซ่อนด้วย CSS — ไม่โหลดใหม่)
 * จำค่าที่เลือกใน cookie ให้หน้าถัดไปเปิดมาแบบเดิม
 */
export function MatrixCard({ initial, title, source, children }: { initial: MatrixShow; title: string; source: string; children: React.ReactNode }) {
  const [show, setShow] = useState<MatrixShow>(initial);
  const pick = (s: MatrixShow) => {
    setShow(s);
    remember(s);
  };
  return (
    <section
      aria-labelledby="matrix-title"
      className="card"
      data-show={show}
      onMouseOver={(e) => markColumn(e.currentTarget, e.target)}
      onMouseLeave={(e) => markColumn(e.currentTarget, null)}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="matrix-title" className="card-title">{title}</h2>
          <p className="text-[0.8125rem] text-ink-3">{source} · คอลัมน์รวม = ทุกเดือนที่ปิดงบแล้ว</p>
        </div>
        <div className="seg" role="group" aria-label="แสดงเป็น">
          {OPTIONS.map((o) => (
            <button key={o.key} type="button" onClick={() => pick(o.key)} aria-pressed={show === o.key} aria-current={show === o.key ? "true" : undefined}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}
