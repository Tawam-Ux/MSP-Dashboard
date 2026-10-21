"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/frontend/components/brand-mark";
import { LampEngine, type Via } from "./lamp-engine";
import { Bookshelf } from "./bookshelf";
import { ChalkBoard } from "./chalk-board";
import { DeskDecor } from "./desk-decor";
import { LoginForm } from "./login-form";

/** ฝุ่นในลำแสง: ตำแหน่งและจังหวะคงที่ (ไม่สุ่มตอน render — server กับ browser ได้ค่าเดียวกัน) · l = % ตามแนวลำแสง · t = % ขวางลำแสง */
const MOTES = [
  { l: 6, t: 47, d: 2, mx: 10, my: -14, dur: 14, delay: -3 },
  { l: 11, t: 54, d: 3, mx: -8, my: -18, dur: 17, delay: -9 },
  { l: 16, t: 43, d: 2, mx: 12, my: -12, dur: 12, delay: -5 },
  { l: 21, t: 58, d: 2, mx: -6, my: -16, dur: 15, delay: -11 },
  { l: 26, t: 40, d: 2, mx: 9, my: -14, dur: 13, delay: -1 },
  { l: 31, t: 62, d: 3, mx: 14, my: -20, dur: 18, delay: -7 },
  { l: 37, t: 46, d: 2, mx: -12, my: -12, dur: 16, delay: -13 },
  { l: 43, t: 55, d: 2, mx: 7, my: -22, dur: 19, delay: -4 },
  { l: 49, t: 36, d: 2, mx: 10, my: -14, dur: 14, delay: -10 },
  { l: 55, t: 66, d: 3, mx: -9, my: -16, dur: 17, delay: -2 },
];

/** เปิดไฟแล้วพร้อมพิมพ์: ช่องชื่อผู้ใช้ถ้ายังว่าง ไม่งั้นช่องรหัสผ่าน */
function focusField(root: HTMLElement | null) {
  const user = root?.querySelector<HTMLInputElement>('input[name="username"]');
  const pass = root?.querySelector<HTMLInputElement>('input[name="password"]');
  (user && user.value === "" ? user : (pass ?? user))?.focus();
}

/**
 * หน้า Login แบบโต๊ะทำงานยามค่ำ: ผนังกระดาษกราฟ โต๊ะไม้ โคมไฟตั้งโต๊ะแขนสปริง การ์ดเข้าสู่ระบบที่ตั้งอยู่บนโต๊ะ
 * กระดานชอล์กกราฟบนผนังซ้าย และชั้นหนังสือกับแจกันดอกไม้บนผนังขวา
 * ห้องมืดตอนเปิดหน้า · ดึงสายใต้หัวโคม (ลาก แตะ หรือ Enter/Space/Tab) = เปิดไฟ แล้วการ์ดปรากฏ · ดึงอีกครั้ง = ปิดไฟ
 * ผังโคมและฟิสิกส์อยู่ใน lamp-engine.ts · สไตล์ใน globals.css (ส่วน "หน้า Login")
 */
export function LampLogin({ callbackUrl }: { callbackUrl: string }) {
  const [lit, setLit] = useState(false);
  // เคยเปิดไฟแล้ว: ปิดไฟครั้งต่อไปมีไส้หลอดเรืองแดงค่อยๆ ดับ (ไม่เล่นตอนเปิดหน้าครั้งแรก)
  const [touched, setTouched] = useState(false);
  const roomRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const lowerArmRef = useRef<HTMLSpanElement>(null);
  const upperArmRef = useRef<HTMLSpanElement>(null);
  const jointsRef = useRef<HTMLSpanElement[]>([]);
  const cordRef = useRef<SVGPathElement>(null);
  const beadRef = useRef<HTMLButtonElement>(null);
  const beadBodyRef = useRef<HTMLSpanElement>(null);
  const emberRef = useRef<HTMLSpanElement>(null);
  const nightRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LampEngine | null>(null);

  useEffect(() => {
    const room = roomRef.current, card = revealRef.current, desk = deskRef.current;
    const head = headRef.current, beam = beamRef.current, base = baseRef.current;
    const lowerArm = lowerArmRef.current, upperArm = upperArmRef.current, joints = jointsRef.current;
    const cord = cordRef.current, bead = beadRef.current, beadBody = beadBodyRef.current;
    const ember = emberRef.current, night = nightRef.current;
    if (!room || !card || !desk || !head || !beam || !base || !lowerArm || !upperArm || joints.length < 3) return;
    if (!cord || !bead || !beadBody || !ember || !night) return;
    const engine = new LampEngine(
      { room, card, desk, head, beam, base, lowerArm, upperArm, joints, cord, bead, beadBody, ember, night },
      (on: boolean, via: Via) => {
        setLit(on);
        setTouched(true);
        // จอสัมผัสไม่โฟกัสให้ — คีย์บอร์ดมือถือจะเด้งขึ้นมาบังตอนไฟกำลังติด
        if (on && via !== "touch") window.setTimeout(() => focusField(card), 380);
        // ปิดไฟขณะโฟกัสอยู่ในฟอร์ม (ซึ่งกำลังจะซ่อน) = โฟกัสกลับมาที่สายดึง
        if (!on && card.contains(document.activeElement)) bead.focus();
      },
    );
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const onError = useCallback(() => engineRef.current?.dip(), []);
  const joint = (i: number) => (el: HTMLSpanElement | null) => {
    if (el) jointsRef.current[i] = el;
  };

  return (
    <main ref={roomRef} className="lamp-room" data-light={lit ? "on" : "off"} data-touched={touched || undefined}>
      {/* ผนังกระดาษกราฟ · แสงโคมบนผนัง · ขอบห้องมืด */}
      <div aria-hidden className="lamp-wall" />
      <div aria-hidden data-lit className="lamp-wall-light" />
      <div aria-hidden data-lit className="lamp-vignette" />

      {/* โคมไฟตั้งโต๊ะ (ตำแหน่งทุกชิ้นตั้งโดย lamp-engine.ts) — ห้องมืดเห็นเป็นเงาหม่น */}
      <div aria-hidden className="lamp-fixture">
        <div ref={beamRef} className="lamp-head-rig">
          <div data-lit className="lamp-beam" />
          <div className="lamp-motes">
            {MOTES.map((m, i) => (
              <span
                key={i}
                className="lamp-mote"
                style={{
                  left: `${m.l}%`, top: `${m.t}%`,
                  "--d": `${m.d}px`, "--mx": `${m.mx}px`, "--my": `${m.my}px`, "--dur": `${m.dur}s`, "--delay": `${m.delay}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
        <div ref={baseRef} className="lamp-base">
          <LampBase />
        </div>
        <span ref={lowerArmRef} className="lamp-arm" />
        <span ref={upperArmRef} className="lamp-arm" />
        {[0, 1, 2].map((i) => (
          <span key={i} ref={joint(i)} className="lamp-joint" />
        ))}
        <div ref={headRef} className="lamp-head-rig">
          <div data-lit className="lamp-glow" />
          <LampHead />
        </div>
      </div>

      {/* การ์ดตั้งอยู่บนโต๊ะ · คำชวนดึงสายอยู่ที่เดียวกันตอนไฟปิด */}
      <div ref={revealRef} className="lamp-reveal" inert={!lit}>
        <section className="lamp-card" aria-labelledby="login-title">
          <div className="flex flex-col items-center text-center">
            <BrandMark size={58} />
            <h1 id="login-title" className="mt-5 text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink">เข้าสู่ระบบ</h1>
            <p className="mt-1 text-sm text-ink-2">Dashboard งบกำไรขาดทุนรายเดือน</p>
          </div>
          <LoginForm callbackUrl={callbackUrl} onError={onError} />
        </section>
      </div>

      {/* ผนังจอกว้าง: กระดานชอล์กฝั่งซ้าย (ซ้ายของโคม เขียนตัวเองเมื่อเปิดไฟ) · ชั้นหนังสือกับแจกันดอกไม้ฝั่งขวาของการ์ด */}
      <ChalkBoard />
      <Bookshelf />
      {/* ของบนโต๊ะ: แก้วกาแฟ แล็ปท็อป กระบอกปากกา (ขวาการ์ด) · สมุดบัญชีกับแว่น นาฬิกาปลุก (ซ้ายฐานโคม) */}
      <DeskDecor />

      <div ref={deskRef} className="lamp-desk">
        <div aria-hidden data-lit className="lamp-desk-pool" />
      </div>

      <div ref={nightRef} aria-hidden className="lamp-night" />

      <div className="lamp-hint" aria-hidden={lit}>
        <p className="lamp-hint-main">ดึงสายเพื่อเปิดไฟ</p>
        <p className="lamp-hint-sub">หรือกด <kbd>Enter</kbd></p>
      </div>

      {/* สายดึง ลูกปัด และไส้หลอดที่ยังเรือง: อยู่เหนือความมืด */}
      <svg aria-hidden className="lamp-cord-line" width="1" height="1">
        <path ref={cordRef} d="M0 0" />
      </svg>
      <span ref={emberRef} aria-hidden className="lamp-ember" />
      <button ref={beadRef} type="button" role="switch" aria-checked={lit} aria-label="สายดึงเปิด-ปิดไฟ" className="lamp-bead">
        <span ref={beadBodyRef} className="lamp-bead-body" />
      </button>
    </main>
  );
}

/** หัวโคม (จุดหมุน = ข้อต่อท้ายหัวโคมที่ 0,0 · ชี้ไปทาง +x): ปลอกขั้วหลอด · โป๊ะกรวยเคลือบแดง MSP · ปากโป๊ะและหลอด (สว่างเมื่อเปิดไฟ) */
function LampHead() {
  return (
    <svg className="lamp-head" viewBox="-22 -62 150 124" width="150" height="124">
      <defs>
        <linearGradient id="lamp-enamel" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ec5b6c" />
          <stop offset="0.38" stopColor="#d3263a" />
          <stop offset="1" stopColor="#7c1020" />
        </linearGradient>
        <linearGradient id="lamp-socket" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5d6068" />
          <stop offset="1" stopColor="#25272c" />
        </linearGradient>
        <linearGradient id="lamp-brass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f0d590" />
          <stop offset="0.5" stopColor="#c39a4c" />
          <stop offset="1" stopColor="#7a5a24" />
        </linearGradient>
        <radialGradient id="lamp-inner" cx="0.3" cy="0.5" r="0.8">
          <stop offset="0" stopColor="#fff6e2" />
          <stop offset="0.5" stopColor="#ffd99e" />
          <stop offset="1" stopColor="#d48a3c" />
        </radialGradient>
        <radialGradient id="lamp-bulb" cx="0.42" cy="0.38" r="0.65">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#fff3d1" />
          <stop offset="1" stopColor="#ffcf7a" />
        </radialGradient>
      </defs>
      <rect x="-14" y="-14" width="32" height="28" rx="9" fill="url(#lamp-socket)" />
      <rect x="14" y="-19" width="7" height="38" rx="3" fill="url(#lamp-brass)" />
      <path d="M20 -18L80 -50Q95 0 80 50L20 18Z" fill="url(#lamp-enamel)" />
      <path d="M26 -21L74 -46" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="85" cy="0" rx="9" ry="50" fill="#1a0a0d" />
      <ellipse data-lit cx="85" cy="0" rx="9.6" ry="50.6" fill="url(#lamp-inner)" />
      <circle cx="88" cy="0" r="12" fill="#2e2b28" />
      <circle data-lit cx="88" cy="0" r="12.7" fill="url(#lamp-bulb)" />
      <ellipse cx="85" cy="0" rx="9" ry="50" fill="none" stroke="url(#lamp-brass)" strokeWidth="2.5" />
    </svg>
  );
}

/** ฐานโคมน้ำหนักถ่วง (มุมมองหน้าตรงสูงกว่าโต๊ะเล็กน้อย): เงาบนโต๊ะ · ด้านข้าง · ผิวบน · ข้อต่อตั้งอยู่กลางผิวบน */
function LampBase() {
  return (
    <svg viewBox="-70 -14 140 38" width="140" height="38">
      <ellipse cx="4" cy="15" rx="72" ry="9" fill="#000" fillOpacity="0.38" />
      <path d="M-62 0V9A62 9 0 0 0 62 9V0Z" fill="#1f2125" />
      <ellipse cx="0" cy="0" rx="62" ry="9" fill="#3a3d44" />
      <ellipse cx="-14" cy="-2" rx="32" ry="3.5" fill="#fff" fillOpacity="0.08" />
    </svg>
  );
}
