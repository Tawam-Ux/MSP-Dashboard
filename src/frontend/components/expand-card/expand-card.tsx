"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { LIFT, placePanel, type Place } from "./geometry";
import s from "./expand-card.module.css";

/** ชี้ค้างนานเท่านี้จึงเปิด (เมาส์แค่ผ่านไม่เปิด) */
const INTENT_MS = 200;
/** เมาส์หลุดขอบชั่วครู่ยังไม่ปิด */
const LEAVE_MS = 90;
/** หุบเสร็จ (ตรงกับ CSS) — หลังจากนี้เปิดใหม่ เนื้อหาเล่นอนิเมชันเข้าใหม่ */
const EXIT_MS = 240;
/** เพิ่งปิดใบหนึ่งแล้วชี้ใบถัดไปภายในช่วงนี้ เปิดทันทีไม่ต้องรอ */
const WARM_MS = 500;

// เปิดได้ทีละใบทั้งหน้า: ใบที่เปิดอยู่ · เวลาที่ใบล่าสุดเพิ่งปิด
let openCard: { id: string; close: () => void } | null = null;
let warmUntil = 0;

/** มุมของเนื้อหาที่ตรึงกับการ์ดเดิมตอนเริ่มขยาย (เนื้อหาเลื่อนจากมุมนี้เข้าที่) */
export type Anchor = { x: "start" | "end"; y: "start" | "end" };

type Props = {
  /** ชื่อของการ์ด (โปรแกรมอ่านหน้าจอ) */
  label: string;
  /** คำอธิบายเพิ่ม ซ่อนจากสายตา — เช่น ค่าทุกเดือนของกราฟในการ์ดที่ขยาย */
  description?: string;
  /** ความกว้างของการ์ดที่ขยาย จากความกว้างการ์ดเดิมและจอ */
  width: (tile: number, view: number) => number;
  place?: Place;
  anchor?: Anchor;
  /** ยื่นพ้นการ์ดเดิมด้านที่ยึด (px) */
  lift?: number;
  /** ระยะจากขอบการ์ดที่ขยายถึงเนื้อหาที่ตรงกับการ์ดเดิม ด้านที่ยึด (px) — การ์ดเดิมกับการ์ดที่ขยายมีระยะในเท่ากัน = 0 */
  inset?: number;
  /** การ์ดที่ขยายแค่ซ้ำการ์ดเดิม + ภาพประกอบ: ซ่อนจากโปรแกรมอ่านหน้าจอ (ใช้ description แทน) */
  decorative?: boolean;
  className?: string;
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
  /** ได้ความกว้างของการ์ดที่ขยาย ก่อนเปิด — ให้กราฟวาดตามขนาดจริง */
  onMeasure?: (width: number) => void;
  onOpenChange?: (open: boolean) => void;
  /** ปุ่มคีย์บอร์ดบนการ์ดระหว่างเปิด (เช่น ลูกศรเลือกเดือน) — คืน true ถ้าจัดการแล้ว */
  onPanelKey?: (e: React.KeyboardEvent) => boolean;
  /** เนื้อหาของการ์ดที่ขยาย */
  panel: React.ReactNode;
  /** การ์ดเดิม: แสดงตามปกติ การ์ดที่ขยายลอยทับตอนเปิด */
  children: React.ReactNode;
};

/**
 * การ์ดที่ขยายแบบรายการแอปใน Microsoft Store: ชี้ค้าง (โฟกัสด้วยคีย์บอร์ด / แตะบนจอสัมผัส / คลิก) → การ์ดคลี่ออกเป็นการ์ดใหญ่ทับตำแหน่งเดิม
 * เปิดได้ทีละใบ · ย้ายจากใบหนึ่งไปอีกใบเปิดทันที · Esc หรือออกจากการ์ด = หุบ
 */
export function ExpandCard({
  label, description, width, place, anchor, lift = LIFT, inset = 0, decorative = false,
  className = "", panelClassName = "", panelStyle, onMeasure, onOpenChange, onPanelKey, panel, children,
}: Props) {
  const uid = useId().replace(/[^\w-]/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const touchRef = useRef(false);
  const skipFocusRef = useRef(false);
  const timers = useRef({ intent: 0, leave: 0, settle: 0 });
  // ค่าล่าสุดของ props ที่ตัวจัดการเหตุการณ์ใช้ (อัปเดตหลัง render)
  const latest = useRef({ width, place, anchor, lift, inset, onMeasure, onOpenChange });
  useLayoutEffect(() => {
    latest.current = { width, place, anchor, lift, inset, onMeasure, onOpenChange };
  });
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);

  const hide = useCallback(() => {
    const t = timers.current;
    window.clearTimeout(t.intent);
    window.clearTimeout(t.leave);
    if (!openRef.current) return;
    openRef.current = false;
    if (openCard?.id === uid) openCard = null;
    warmUntil = performance.now() + WARM_MS;
    setOpen(false);
    latest.current.onOpenChange?.(false);
    window.clearTimeout(t.settle);
    t.settle = window.setTimeout(() => setFresh(false), EXIT_MS);
  }, [uid]);

  const show = useCallback(() => {
    const t = timers.current;
    window.clearTimeout(t.intent);
    window.clearTimeout(t.leave);
    if (openRef.current) return;
    // เปิดใหม่ระหว่างกำลังหุบ: เนื้อหายังอยู่ครบ ไม่เล่นอนิเมชันซ้ำ
    window.clearTimeout(t.settle);
    if (openCard && openCard.id !== uid) openCard.close();
    openCard = { id: uid, close: hide };
    openRef.current = true;
    setFresh(true);
    setOpen(true);
    latest.current.onOpenChange?.(true);
  }, [uid, hide]);

  /** วัดการ์ดเดิมแล้ววางการ์ดที่ขยาย (ยังซ่อนอยู่) ให้จุดเริ่มของการขยาย = กรอบการ์ดเดิมพอดี */
  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const panelEl = panelRef.current;
    if (!wrap || !panelEl) return;
    const cfg = latest.current;
    const tile = wrap.getBoundingClientRect();
    const view = {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
      top: document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0,
    };
    const w = cfg.width(tile.width, view.width);
    panelEl.style.setProperty("--x-w", `${w}px`);
    const h = panelEl.getBoundingClientRect().height;
    const { x, y } = placePanel(tile, { width: w, height: h }, view, cfg.place, cfg.lift);
    const vars: Record<string, number> = {
      "--x-x": x,
      "--x-y": y,
      // กรอบเริ่มต้น = ขอบการ์ดเดิม (วัดจากขอบการ์ดที่ขยาย)
      "--x-ct": -y,
      "--x-cl": -x,
      "--x-cr": x + w - tile.width,
      "--x-cb": y + h - tile.height,
      // เนื้อหาเริ่มที่ตำแหน่งเดิมในการ์ด ยึดมุมตาม anchor
      "--x-dx": cfg.anchor?.x === "end" ? tile.width - (x + w - cfg.inset) : -(x + cfg.inset),
      "--x-dy": cfg.anchor?.y === "end" ? tile.height - (y + h - cfg.inset) : -(y + cfg.inset),
    };
    for (const [k, v] of Object.entries(vars)) panelEl.style.setProperty(k, `${v}px`);
    // ให้สไตล์ตอนซ่อนที่ตำแหน่งใหม่มีผลก่อนเปิด — การขยายจึงเริ่มจากกรอบการ์ดพอดี ไม่กระโดด
    panelEl.getBoundingClientRect();
    cfg.onMeasure?.(w);
  }, []);

  /** เริ่มเปิด: วางตำแหน่งทันที แล้วเปิดเมื่อแน่ใจว่าตั้งใจชี้ (now / มีใบเปิดอยู่ / เพิ่งปิดใบอื่น = เปิดเลย) */
  const arm = useCallback((now: boolean) => {
    const t = timers.current;
    window.clearTimeout(t.leave);
    if (openRef.current) return;
    window.clearTimeout(t.intent);
    measure();
    if (now || openCard || performance.now() < warmUntil) show();
    else t.intent = window.setTimeout(show, INTENT_MS);
  }, [measure, show]);

  const disarm = useCallback(() => {
    const t = timers.current;
    window.clearTimeout(t.intent);
    if (openRef.current) t.leave = window.setTimeout(hide, LEAVE_MS);
  }, [hide]);

  // เปิดอยู่: แตะ/คลิกนอกการ์ด หรือย่อขยายหน้าต่าง = หุบ
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) hide();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  // ออกจากหน้าระหว่างเปิด: ล้างตัวจับเวลาและสถานะร่วม
  useEffect(() => {
    const t = timers.current;
    return () => {
      window.clearTimeout(t.intent);
      window.clearTimeout(t.leave);
      window.clearTimeout(t.settle);
      if (openCard?.id === uid) openCard = null;
    };
  }, [uid]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && openRef.current) {
      e.preventDefault();
      hide();
      // ออกจากลิงก์ในการ์ดที่ขยาย กลับมาที่การ์ด (ไม่เปิดซ้ำ)
      if (e.target !== e.currentTarget) {
        skipFocusRef.current = true;
        e.currentTarget.focus();
        skipFocusRef.current = false;
      }
      return;
    }
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (openRef.current) hide();
      else arm(true);
    } else if (openRef.current && onPanelKey?.(e)) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`${s.wrap} ${className}`}
      data-open={open || undefined}
      tabIndex={0}
      role="group"
      aria-label={label}
      aria-describedby={description ? `${uid}-desc` : undefined}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") arm(false);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") disarm();
      }}
      onPointerDown={(e) => {
        touchRef.current = e.pointerType === "touch";
      }}
      onClick={(e) => {
        // คลิกในการ์ดที่ขยาย (ลิงก์ / กราฟ) จัดการเอง · แตะการ์ดเดิมบนจอสัมผัส = เปิด/ปิด · คลิกด้วยเมาส์ = เปิดเลยไม่ต้องรอ
        if (panelRef.current?.contains(e.target as Node)) return;
        if (touchRef.current && openRef.current) hide();
        else arm(true);
      }}
      onFocus={(e) => {
        if (e.target === e.currentTarget && !skipFocusRef.current && e.currentTarget.matches(":focus-visible")) arm(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
      }}
      onKeyDown={onKeyDown}
    >
      {children}
      <div
        ref={panelRef}
        className={s.panel}
        data-state={open ? "open" : "closed"}
        data-fresh={fresh || undefined}
        aria-hidden={decorative || undefined}
        style={panelStyle}
      >
        <div className={s.sheet}>
          <div className={`${s.shift} ${panelClassName}`}>{panel}</div>
        </div>
      </div>
      {description && <span id={`${uid}-desc`} className="sr-only">{description}</span>}
    </div>
  );
}
