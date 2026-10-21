/**
 * กระดานชอล์กติดผนังฝั่งซ้าย (ซ้ายของโคม): กราฟแท่งเทียนเขียนด้วยชอล์กบนกระดานดำโทนเขียวในกรอบไม้ มีรางชอล์กพร้อมชอล์กหนึ่งแท่งกับแปรงลบ
 * โครงกราฟเดิม (สเกลราคาขวา เวลาล่าง เส้นราคาล่าสุดพร้อมป้าย) · ชอล์กขาว = แกนและตัวเลข · เขียว/ชมพู = แท่งขึ้น/ลง · เหลือง = ราคาล่าสุด
 * ข้อมูลเป็นตัวอย่างตกแต่งล้วน — หน้า Login ยังไม่ได้ยืนยันตัวตน ห้ามแสดงตัวเลขจริงของบริษัท
 * เนื้อชอล์ก (ขอบสาก + เนื้อขาดเป็นช่วง) มาจาก SVG filter เดียวทั้งกราฟ · เปิดไฟแล้วกราฟเขียนตัวเองครั้งเดียว (CSS) แล้วนิ่ง
 */

type Candle = { t: number; o: number; h: number; l: number; c: number };

/** ขนาดกราฟ (หน่วย viewBox) 3:2 — globals.css คำนวณความสูงกระดานจากสัดส่วนนี้ (.chalk-board) */
const W = 450;
const H = 300;
/** สเกลราคาด้านขวา · แถบเวลาด้านล่าง · ระยะเว้นขอบบนของกราฟ */
const AXIS = 56;
const TIME = 18;
const TOP = 14;
const PLOT_L = 8;
const PLOT_R = W - AXIS - 8;
const PLOT_B = H - TIME - 8;
const N = 40;
const STEP = (PLOT_R - PLOT_L) / N;
const CHALK = { green: "#9fe3b4", pink: "#f6a1a1" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** แท่งแรกของกราฟรายชั่วโมง (เวลา UTC — server กับ browser ได้ป้ายเวลาเดียวกัน) */
const T0 = Date.UTC(2026, 9, 19, 0);

const price = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** สุ่มแบบกำหนดค่าเริ่มได้ (mulberry32): กราฟเหมือนกันทุกครั้งทั้งฝั่ง server และ browser */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** แท่งเทียนตัวอย่าง: แนวโน้มขึ้นช้าๆ มีแกว่งขึ้นลงตามธรรมชาติ */
function sampleCandles(): Candle[] {
  const rnd = seeded(20261020);
  const out: Candle[] = [];
  let last = 1000;
  for (let t = 0; t < N; t++) {
    const o = last;
    const c = Math.round((o + (rnd() - 0.42) * 7) * 100) / 100;
    out.push({ t, o, c, h: Math.max(o, c) + rnd() * 3.2, l: Math.min(o, c) - rnd() * 3.2 });
    last = c;
  }
  return out;
}
const CANDLES = sampleCandles();

/** ระยะเส้นตารางราคาแบบตัวเลขกลม (1 / 2 / 5 × 10ⁿ) */
function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

function timeLabel(t: number) {
  const d = new Date(T0 + t * 3_600_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, "0")}:00`;
}

export function ChalkBoard() {
  const lo = Math.min(...CANDLES.map((k) => k.l));
  const hi = Math.max(...CANDLES.map((k) => k.h));
  const pad = (hi - lo) * 0.1 || 1;
  const top = hi + pad;
  const bottom = lo - pad;
  const y = (p: number) => TOP + ((top - p) / (top - bottom)) * (PLOT_B - TOP);
  const step = niceStep((top - bottom) / 5);
  const levels: number[] = [];
  for (let v = Math.ceil(bottom / step) * step; v <= top; v += step) levels.push(v);
  const last = CANDLES[CANDLES.length - 1].c;
  const lastY = y(last);

  return (
    <div aria-hidden className="chalk-board">
      <div className="chalk-slate">
        <svg className="chalk-chart" viewBox={`0 0 ${W} ${H}`}>
          <defs>
            {/* เนื้อชอล์ก: ขอบเส้นสากเล็กน้อย แล้วเจาะเนื้อให้ขาดเป็นช่วงแบบชอล์กบนกระดาน */}
            <filter id="chalk-texture" x="-2%" y="-2%" width="104%" height="104%">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="wobble" />
              <feDisplacementMap in="SourceGraphic" in2="wobble" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="rough" />
              <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="1" seed="9" result="grain" />
              <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.4 2.15" result="bite" />
              <feComposite in="rough" in2="bite" operator="in" />
            </filter>
          </defs>
          <g filter="url(#chalk-texture)">
            {/* เส้นตารางชอล์กจาง: ราคา (แนวนอน) · เวลา ทุก 8 แท่ง (แนวตั้ง) */}
            {levels.map((v) => (
              <line key={v} className="chalk-grid" x1={PLOT_L} x2={W - AXIS} y1={y(v)} y2={y(v)} />
            ))}
            {CANDLES.map((k, i) =>
              k.t % 8 === 0 ? <line key={`g${k.t}`} className="chalk-grid" x1={PLOT_L + (i + 0.5) * STEP} x2={PLOT_L + (i + 0.5) * STEP} y1={TOP - 4} y2={H - TIME} /> : null,
            )}
            {/* แกนราคา (ขวา) และแกนเวลา (ล่าง): ลากตัวเองตอนเปิดไฟ */}
            <path className="chalk-axis" pathLength={1} d={`M${W - AXIS} 6V${H - TIME}H${PLOT_L}`} />
            {/* ป้ายราคาบนสเกล: ข้ามตัวที่ป้ายราคาล่าสุดบังอยู่ */}
            {levels.map((v) =>
              Math.abs(y(v) - lastY) > 11 ? <text key={`p${v}`} className="chalk-label" x={W - AXIS + 6} y={y(v) + 3}>{price.format(v)}</text> : null,
            )}
            {CANDLES.map((k, i) =>
              k.t % 8 === 0 ? <text key={`t${k.t}`} className="chalk-label" x={PLOT_L + (i + 0.5) * STEP + 3} y={H - 6}>{timeLabel(k.t)}</text> : null,
            )}

            {/* แท่งเทียนชอล์ก: เขียนทีละแท่งจากซ้ายไปขวา */}
            {CANDLES.map((k, i) => {
              const x = PLOT_L + (i + 0.5) * STEP;
              const color = k.c >= k.o ? CHALK.green : CHALK.pink;
              const bodyTop = y(Math.max(k.o, k.c));
              return (
                <g key={k.t} className="chalk-candle" style={{ "--i": i } as React.CSSProperties} stroke={color} fill={color}>
                  <line x1={x} x2={x} y1={y(k.h)} y2={y(k.l)} />
                  <rect x={x - STEP * 0.3} y={bodyTop} width={STEP * 0.6} height={Math.max(1.2, y(Math.min(k.o, k.c)) - bodyTop)} />
                </g>
              );
            })}

            {/* ราคาล่าสุดด้วยชอล์กเหลือง: เส้นประ + ป้ายในกรอบบนสเกล */}
            <g className="chalk-last">
              <line className="chalk-last-line" x1={PLOT_L} x2={W - AXIS} y1={lastY} y2={lastY} />
              <rect className="chalk-last-box" x={W - AXIS + 2} y={lastY - 7} width={AXIS - 6} height={14} rx={2} />
              <text className="chalk-last-text" x={W - AXIS + 6} y={lastY + 3}>{price.format(last)}</text>
            </g>
          </g>
        </svg>
      </div>
      {/* รางชอล์กใต้กระดาน: ชอล์กหนึ่งแท่งกับแปรงลบ */}
      <span className="chalk-tray">
        <span className="chalk-stick" />
        <span className="chalk-eraser" />
      </span>
    </div>
  );
}
