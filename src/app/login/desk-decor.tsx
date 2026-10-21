"use client";

import { useEffect, useRef } from "react";

/**
 * ของบนโต๊ะ (จอ ≥1360px — globals.css .desk-decor)
 * ชุดขวา (ขวาการ์ด): แก้วกาแฟมีไอร้อน · แล็ปท็อปเปิดจอ · กระบอกใส่ไม้บรรทัด ดินสอ ปากกา
 * ชุดซ้าย (ซ้ายฐานโคม): กองสมุดบัญชีมีแว่นอ่านหนังสือวางบน · นาฬิกาปลุกกระดิ่งคู่ บอกเวลาจริงของเครื่องผู้ใช้
 * วาดเป็น SVG สองชุด ขอบล่างของภาพ = ก้นของบนผิวโต๊ะ (เงาเลยขอบล่างลงบนโต๊ะ)
 * ด้านที่หันเข้าหาโคมสว่างกว่า (ชุดขวารับแสงจากซ้าย ชุดซ้ายรับแสงจากขวา) เงาตกไปอีกฝั่ง
 * จอแล็ปท็อปเป็นหน้า P&L Analysis ย่อส่วน (การ์ด KPI สี่ใบ) ตัวเลขปิดเป็นจุด — หน้า Login ยังไม่ได้ยืนยันตัวตน ห้ามแสดงตัวเลขของบริษัท
 */

/** สมุดบัญชีนอนซ้อน (เห็นสัน): x/y = มุมซ้ายบน · c = สีปก · b = สีแถบ */
type Ledger = { x: number; y: number; w: number; h: number; c: string; b: string };

const LEDGERS: Ledger[] = [
  { x: 12, y: 132, w: 184, h: 18, c: "#2c3e5c", b: "#c9a35c" },
  { x: 22, y: 116, w: 166, h: 16, c: "#6b4a2f", b: "#d8c39a" },
  { x: 8, y: 102, w: 172, h: 14, c: "#2f5a46", b: "#c9a35c" },
];

/** จุดศูนย์กลางหน้าปัดนาฬิกา */
const CLOCK = { x: 250, y: 114 };

/**
 * การ์ด KPI บนจอแล็ปท็อป แบบหน้า P&L Analysis ของเว็บ (components/dash.tsx Kpi): ป้ายวงกลมสีสาย + รหัส · ชื่อ · ตัวเลข · ลูกศรเทียบเดือนก่อน
 * ตัวเลขปิดเป็นจุด (หน้า Login ยังไม่ได้ยืนยันตัวตน) · OP สีอ่อน จึงใช้ตัวอักษรเข้มในป้ายวงกลม (ตรงกับ .roundel[data-light])
 */
const KPIS = [
  { code: "REV", label: "Revenue", c: "#2f6fd6", up: true, dark: false },
  { code: "GP", label: "Gross Profit", c: "#237a61", up: true, dark: false },
  { code: "OP", label: "Operating Profit", c: "#e3a21a", up: false, dark: true },
  { code: "PBT", label: "PBT", c: "#7b4fc9", up: true, dark: false },
];

function LedgerBook({ x, y, w, h, c, b }: Ledger) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.6} fill={c} />
      <rect x={x + 8} y={y} width={2.6} height={h} fill={b} />
      <rect x={x + w - 10.6} y={y} width={2.6} height={h} fill={b} />
      <rect x={x + w * 0.36} y={y + h * 0.28} width={w * 0.28} height={h * 0.44} rx={1} fill={b} opacity={0.55} />
      <rect x={x} y={y} width={w} height={1.2} fill="#fff" opacity={0.12} />
      <rect x={x} y={y + h - 2} width={w} height={2} fill="#000" opacity={0.2} />
    </g>
  );
}

export function DeskDecor() {
  const hour = useRef<SVGGElement>(null);
  const minute = useRef<SVGGElement>(null);
  const second = useRef<SVGGElement>(null);

  // นาฬิกาเดินตามเวลาเครื่องผู้ใช้: ตั้งเข็มทุกต้นวินาที (เขียน attribute ตรง ไม่ผ่าน React state)
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const now = new Date();
      const s = now.getSeconds();
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      hour.current?.setAttribute("transform", `rotate(${(h * 30).toFixed(2)})`);
      minute.current?.setAttribute("transform", `rotate(${(m * 6).toFixed(2)})`);
      second.current?.setAttribute("transform", `rotate(${s * 6})`);
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div aria-hidden className="desk-decor desk-decor-left">
        <svg viewBox="0 0 300 150">
          <defs>
            <linearGradient id="decor-brass" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f0d79b" />
              <stop offset="0.5" stopColor="#c9a35c" />
              <stop offset="1" stopColor="#8f6a2e" />
            </linearGradient>
            <radialGradient id="decor-face" cx="0.55" cy="0.45" r="0.6">
              <stop offset="0" stopColor="#fffaf0" />
              <stop offset="1" stopColor="#ece2cf" />
            </radialGradient>
            <filter id="decor-soft-l" x="-20%" y="-200%" width="140%" height="500%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>

          {/* กองสมุดบัญชี + แว่นอ่านหนังสือพับขาวางบนสุด */}
          <ellipse cx={98} cy={150} rx={96} ry={4.6} fill="#000" opacity={0.3} filter="url(#decor-soft-l)" />
          {LEDGERS.map((k) => (
            <LedgerBook key={k.y} {...k} />
          ))}
          <g fill="none" stroke="#2a2c32" strokeLinecap="round">
            <path d="M60 96L104 94M62 94.5L106 97" strokeWidth={1.6} />
            <circle cx={72} cy={92} r={10} fill="#d6e6ec" fillOpacity={0.22} strokeWidth={2.2} />
            <circle cx={98} cy={92} r={10} fill="#d6e6ec" fillOpacity={0.22} strokeWidth={2.2} />
            <path d="M82 90Q85 86.5 88 90" strokeWidth={2} />
          </g>
          <path d="M75 85.5A7 7 0 0 1 78.6 89M101 85.5A7 7 0 0 1 104.6 89" fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.4} strokeLinecap="round" />

          {/* นาฬิกาปลุกกระดิ่งคู่: กระดิ่ง ค้อนกริ่ง ขา ตัวเรือนทองเหลือง หน้าปัด เข็ม (เข็มวินาทีสีมัสตาร์ด) */}
          <ellipse cx={244} cy={150} rx={34} ry={4} fill="#000" opacity={0.3} filter="url(#decor-soft-l)" />
          <g className="decor-clock">
            {[-40, 40].map((a) => (
              <g key={a} transform={`translate(${CLOCK.x + (a < 0 ? -20 : 20)} ${CLOCK.y - 24}) rotate(${a})`}>
                <path d="M-11 0A11 11 0 0 1 11 0Z" fill="url(#decor-brass)" />
                <circle cy={-11} r={1.8} fill="#a8823f" />
              </g>
            ))}
            <g className="decor-hammer">
              <path d={`M${CLOCK.x} ${CLOCK.y - 29}V${CLOCK.y - 35}`} stroke="#8f6a2e" strokeWidth={1.6} />
              <circle cx={CLOCK.x} cy={CLOCK.y - 36} r={2.2} fill="#a8823f" />
            </g>
            <ellipse cx={CLOCK.x - 12} cy={146.6} rx={6} ry={3.4} fill="#8f6a2e" />
            <ellipse cx={CLOCK.x + 12} cy={146.6} rx={6} ry={3.4} fill="#b48c48" />
            <circle cx={CLOCK.x} cy={CLOCK.y} r={30} fill="url(#decor-brass)" />
            <circle cx={CLOCK.x} cy={CLOCK.y} r={26.4} fill="#7d5f27" />
            <circle cx={CLOCK.x} cy={CLOCK.y} r={25.2} fill="url(#decor-face)" />
            <g transform={`translate(${CLOCK.x} ${CLOCK.y})`} stroke="#2a2c32" strokeLinecap="round">
              {Array.from({ length: 12 }, (_, i) => (
                <line key={i} y1={-22.6} y2={i % 3 === 0 ? -18.4 : -20.4} strokeWidth={i % 3 === 0 ? 1.8 : 1} transform={`rotate(${i * 30})`} />
              ))}
              <g ref={hour}>
                <path d="M0 3V-11.5" strokeWidth={3} />
              </g>
              <g ref={minute}>
                <path d="M0 4V-17.5" strokeWidth={2} />
              </g>
              <g ref={second} className="decor-clock-second">
                <path d="M0 5V-20" stroke="#c79a3a" strokeWidth={1} />
              </g>
              <circle r={2.6} fill="#2a2c32" stroke="none" />
              <circle r={1.2} fill="#c79a3a" stroke="none" />
            </g>
            <path
              d={`M${CLOCK.x + 12} ${CLOCK.y - 20}A21 21 0 0 1 ${CLOCK.x + 20} ${CLOCK.y - 7}`}
              fill="none"
              stroke="#fff"
              strokeOpacity={0.5}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      <div aria-hidden className="desk-decor desk-decor-right">
        <svg viewBox="0 0 384 150">
          <defs>
            <linearGradient id="decor-mug" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fbf5ea" />
              <stop offset="0.45" stopColor="#efe4d2" />
              <stop offset="1" stopColor="#c9baa0" />
            </linearGradient>
            <linearGradient id="decor-lid" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#3c3f46" />
              <stop offset="1" stopColor="#202227" />
            </linearGradient>
            <linearGradient id="decor-deck" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#e2e4e8" />
              <stop offset="1" stopColor="#b9bcc4" />
            </linearGradient>
            <linearGradient id="decor-cup" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#6a6d75" />
              <stop offset="0.5" stopColor="#3a3d44" />
              <stop offset="1" stopColor="#24262b" />
            </linearGradient>
            <filter id="decor-soft-r" x="-20%" y="-200%" width="140%" height="500%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>

          {/* แก้วกาแฟเซรามิกคาดแถบกรมท่า · ไอร้อนลอยขึ้นเมื่อเปิดไฟ */}
          <ellipse cx={56} cy={150} rx={34} ry={4.2} fill="#000" opacity={0.28} filter="url(#decor-soft-r)" />
          <path d="M65 98C82 95 89 107 87 118C85 130 76 136 64 134" fill="none" stroke="#cdbfa6" strokeWidth={7} strokeLinecap="round" />
          <path d="M65 98C80 96 85 107 84 117" fill="none" stroke="#e6dac6" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
          <path d="M14 86H66L63 142Q62.4 150 55 150H25Q17.6 150 17 142Z" fill="url(#decor-mug)" />
          <path d="M14.3 92H65.7L65.3 100H14.7Z" fill="#2c3e5c" />
          <ellipse cx={40} cy={86} rx={26} ry={4.6} fill="#f3ebdc" />
          <ellipse cx={40} cy={86.8} rx={22.6} ry={3.3} fill="#3b2416" />
          <ellipse cx={34} cy={86.2} rx={7} ry={0.9} fill="#fff" opacity={0.2} />
          <path d="M21 106C20 118 20.4 129 22.4 138" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" />
          <g className="decor-steam" fill="none" strokeLinecap="round">
            <path d="M32 78C27 68 36 62 32 52C28 42 35 36 33 28" />
            <path d="M41 76C46 66 37 59 42 49C47 39 39 32 43 22" />
            <path d="M50 78C54 70 47 64 51 56C55 48 49 43 52 36" />
          </g>

          {/* แล็ปท็อปเปิดจอหันหาผู้ชม: จอดับตอนห้องมืด ตื่นขึ้นหลังไฟติด (globals.css .decor-screen) · ฐานคีย์บอร์ดเห็นเอียงลึก */}
          <ellipse cx={208} cy={150} rx={106} ry={4.6} fill="#000" opacity={0.3} filter="url(#decor-soft-r)" />
          <rect x={112} y={46} width={184} height={90} rx={4} fill="url(#decor-lid)" />
          <path d="M113.6 50V132" stroke="#fff" strokeOpacity={0.12} strokeWidth={1} />
          <circle cx={204} cy={49} r={1} fill="#4a4d55" />
          <rect x={118} y={52} width={172} height={76} rx={1.5} fill="#121418" />
          {/* จอ: หน้า P&L Analysis ย่อส่วน — แถบบนสีขาว (แท็บที่เลือกเป็นเม็ดยาเข้ม · ชิปผู้ใช้) · หัวหน้า + ตัวเลือกงวด · การ์ด KPI 2×2
              วาดในพื้นที่ขยาย 4 เท่า (688×304) แล้วย่อลง: ตัวอักษรเล็กไม่โดนขนาดตัวอักษรขั้นต่ำของเบราว์เซอร์ */}
          <g className="decor-screen">
            <g transform="translate(118 52) scale(0.25)">
              <path d="M6 0H682Q688 0 688 6V36H0V6Q0 0 6 0Z" fill="#fff" />
              <path d="M0 36H688V298Q688 304 682 304H6Q0 304 0 298Z" fill="#f3f4f7" />
              <path d="M0 36H688" stroke="#e3e5ea" strokeWidth={1.6} />
              <rect x={16} y={10.4} width={28} height={15.2} rx={4} fill="#1b1f2a" />
              <rect x={64} y={9.6} width={60} height={16.8} rx={8.4} fill="#1b1f2a" />
              <rect x={76} y={16.2} width={36} height={3.6} rx={1.8} fill="#fff" />
              {[
                { x: 140, w: 32 },
                { x: 188, w: 40 },
                { x: 244, w: 28 },
              ].map((t) => (
                <rect key={t.x} x={t.x} y={16.2} width={t.w} height={3.6} rx={1.8} fill="#9aa0ad" />
              ))}
              <rect x={600} y={8.8} width={80} height={18.4} rx={9.2} fill="#eef0f4" />
              <circle cx={609.6} cy={18} r={6.8} fill="#1b1f2a" />
              <rect x={622} y={13.4} width={44} height={3.2} rx={1.6} fill="#4b5263" />
              <rect x={622} y={19.6} width={28} height={2.8} rx={1.4} fill="#9aa0ad" />

              <text x={16} y={61} className="decor-ui" fontSize={13.6} fontWeight={700} fill="#1b1f2a">
                {"P&L Analysis"}
              </text>
              <rect x={16} y={66.4} width={104} height={3.6} rx={1.8} fill="#9aa0ad" />
              <rect x={576} y={49.6} width={96} height={20} rx={10} fill="#fff" />
              <rect x={588} y={57.8} width={52} height={3.6} rx={1.8} fill="#4b5263" />
              <path d="M652 57.2l4.8 4.8 4.8-4.8" fill="none" stroke="#626979" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

              {KPIS.map((k, i) => {
                const x = 16 + (i % 2) * 336;
                const y = 78.4 + Math.floor(i / 2) * 116;
                const tone = k.up ? "#1f7a5c" : "#b4161f";
                return (
                  <g key={k.code}>
                    <rect x={x} y={y + 2.8} width={320} height={101.6} rx={18} fill="#161b28" opacity={0.07} />
                    <rect x={x} y={y} width={320} height={101.6} rx={18} fill="#fff" />
                    <circle cx={x + 29.6} cy={y + 29.6} r={16.4} fill={k.c} opacity={0.14} />
                    <circle cx={x + 29.6} cy={y + 29.6} r={13.6} fill={k.c} />
                    <text x={x + 29.6} y={y + 32.4} textAnchor="middle" className="decor-ui" fontSize={8} fontWeight={700} fill={k.dark ? "#1b1f2a" : "#fff"}>
                      {k.code}
                    </text>
                    <text x={x + 51.2} y={y + 33.6} className="decor-ui" fontSize={11.2} fontWeight={500} fill="#4b5263">
                      {k.label}
                    </text>
                    <text x={x + 16} y={y + 70} className="decor-ui" fill="#1b1f2a">
                      <tspan fontSize={22.4} fontWeight={600}>
                        •••.••
                      </tspan>
                      <tspan dx={4} fontSize={10.4} fill="#626979">
                        ล้านบาท
                      </tspan>
                    </text>
                    <path d={k.up ? `M${x + 16} ${y + 88}l3.8-7.2 3.8 7.2z` : `M${x + 16} ${y + 80.8}l3.8 7.2 3.8-7.2z`} fill={tone} />
                    <text x={x + 26} y={y + 88} className="decor-ui" fontSize={10.4}>
                      <tspan fill={tone} fontWeight={600}>
                        ••%
                      </tspan>
                      <tspan dx={4} fill="#626979">
                        เทียบเดือนก่อน
                      </tspan>
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
          <path d="M118 52H176L140 128H118Z" fill="#fff" opacity={0.05} />
          <rect x={112} y={135.2} width={184} height={1.8} fill="#000" opacity={0.3} />
          <path d="M110 136H298L306 147H102Z" fill="url(#decor-deck)" />
          <path d="M122 137.6H286L290.6 143.6H117.4Z" fill="#2e3138" opacity={0.9} />
          <path d="M120.5 139.6H287.5M118.9 141.6H289.1" stroke="#6a6d75" strokeWidth={0.5} opacity={0.8} />
          <path d="M186 144.4H222L223 146.4H185Z" fill="#a9adb5" />
          <path d="M102 147H306V148.2Q306 150 304 150H104Q102 150 102 148.2Z" fill="#8e929b" />
          <rect x={194} y={147} width={20} height={1.2} rx={0.6} fill="#6a6d75" />

          {/* กระบอกโลหะใส่ไม้บรรทัด ดินสอสองแท่ง ปากกา (เลื่อนขวาให้พ้นแล็ปท็อป) */}
          <g transform="translate(24 0)">
            <ellipse cx={324} cy={150} rx={27} ry={3.8} fill="#000" opacity={0.3} filter="url(#decor-soft-r)" />
            <ellipse cx={320} cy={108} rx={22} ry={3.6} fill="#1b1c20" />
            <path d="M298 108Q320 100.8 342 108" fill="none" stroke="#4a4d55" strokeWidth={1} />
            <g transform="rotate(-9 312 134)">
              <rect x={306} y={56} width={10} height={80} rx={1} fill="#d8c39a" />
              {Array.from({ length: 18 }, (_, i) => (
                <path key={i} d={`M306 ${60 + i * 4}H${i % 5 === 0 ? 311 : 309}`} stroke="#7a5232" strokeWidth={0.8} />
              ))}
            </g>
            {[
              { a: -15, x: 315, top: 62 },
              { a: 12, x: 321, top: 52 },
            ].map((p) => (
              <g key={p.a} transform={`rotate(${p.a} ${p.x + 3} 134)`}>
                <rect x={p.x} y={p.top} width={6.4} height={136 - p.top} fill="#e3b23c" />
                <rect x={p.x + 2.2} y={p.top} width={2} height={136 - p.top} fill="#c99a2e" />
                <rect x={p.x} y={p.top} width={6.4} height={6} fill="#b9b4aa" />
                <rect x={p.x} y={p.top - 6.5} width={6.4} height={7.5} rx={2.4} fill="#efc4b5" />
              </g>
            ))}
            <g transform="rotate(3 331 134)">
              <rect x={328} y={48} width={6} height={88} rx={3} fill="#2c3e5c" />
              <rect x={328} y={48} width={6} height={7} rx={3} fill="#22324d" />
              <rect x={334} y={54} width={1.6} height={20} rx={0.8} fill="#c9ccd2" />
            </g>
            <path d="M298 108H342V144Q342 150 336 150H304Q298 150 298 144Z" fill="url(#decor-cup)" />
            <path d="M298 108Q320 115.2 342 108" fill="none" stroke="#7a7d85" strokeWidth={1.2} />
            <path d="M302.5 114V143" stroke="#fff" strokeOpacity={0.18} strokeWidth={2.2} strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </>
  );
}
