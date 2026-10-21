/**
 * ชั้นหนังสือติดผนังฝั่งขวาของการ์ด: ชั้นไม้โอ๊กสองชั้นบนฉากเหล็ก (วาดด้วยรูปทรงเรขาคณิต ไม่มีรูปภาพ)
 * ชั้นบน = หนังสือยืน · สองเล่มล้มพิงกันต่อกันเป็นทอด · สองเล่มล้มนอนซ้อนกัน
 * ชั้นล่าง = แจกันเซรามิกปักดอกไม้ · หนังสือยืน · กองหนังสือนอนสามเล่ม
 * สีปกโทนสงบ เลี่ยงแดง MSP (สงวนไว้ให้หัวโคมกับปุ่ม) · แสงโคมมาจากทางซ้าย ขอบซ้ายของปกจึงสว่างกว่า
 */

/** หนังสือยืน: x = ขอบซ้าย · w = ความหนาสัน · h = ความสูง · c = สีปก · b = สีแถบบนสัน */
type Book = { x: number; w: number; h: number; c: string; b: string };
/** หนังสือนอน: y = ขอบบน */
type FlatBook = { x: number; y: number; w: number; h: number; c: string; b: string };

const UPPER = 118;
const LOWER = 268;

const UPPER_BOOKS: Book[] = [
  { x: 12, w: 18, h: 94, c: "#2c3e5c", b: "#c9a35c" },
  { x: 31, w: 13, h: 82, c: "#2f5a46", b: "#d8c39a" },
  { x: 45, w: 22, h: 102, c: "#c79a3a", b: "#7a5232" },
  { x: 68, w: 11, h: 76, c: "#e8dcc2", b: "#a97c50" },
  { x: 80, w: 19, h: 90, c: "#3a3d44", b: "#c9a35c" },
  { x: 100, w: 15, h: 98, c: "#3e7c7a", b: "#e8dcc2" },
  { x: 116, w: 24, h: 86, c: "#a97c50", b: "#6b4a2f" },
];
/**
 * ล้มพิงกัน: หมุนรอบมุมล่างซ้าย (มุมที่ยังแตะชั้น) · มุมบนซ้ายพิงขอบขวาของเล่มก่อนหน้าพอดี
 * เล่มแรกพิงเล่มยืนสุดท้าย (ขอบขวา x 140) · เล่มที่สองพิงหน้าขวาของเล่มแรก
 */
const LEANING = [
  { px: 170, w: 14, h: 88, a: -20, c: "#6b4c7a", b: "#d8c39a" },
  { px: 204.6, w: 12, h: 76, a: -34, c: "#5b6f8f", b: "#e8dcc2" },
];
const UPPER_FLAT: FlatBook[] = [
  { x: 222, y: UPPER - 13, w: 84, h: 13, c: "#7a7d3c", b: "#e8dcc2" },
  { x: 230, y: UPPER - 24, w: 70, h: 11, c: "#d8c39a", b: "#7a5232" },
];
const LOWER_BOOKS: Book[] = [
  { x: 128, w: 16, h: 84, c: "#7a5232", b: "#d8c39a" },
  { x: 145, w: 20, h: 96, c: "#2f5a46", b: "#c9a35c" },
  { x: 166, w: 13, h: 78, c: "#e8dcc2", b: "#3e7c7a" },
  { x: 180, w: 18, h: 90, c: "#2c3e5c", b: "#e8dcc2" },
];
const LOWER_FLAT: FlatBook[] = [
  { x: 212, y: LOWER - 14, w: 90, h: 14, c: "#3e7c7a", b: "#e8dcc2" },
  { x: 218, y: LOWER - 26, w: 80, h: 12, c: "#c79a3a", b: "#2c3e5c" },
  { x: 224, y: LOWER - 36, w: 66, h: 10, c: "#6b4c7a", b: "#d8c39a" },
];

/** ดอกไม้ในแจกัน: ปลายก้าน (ดอก) · จุดควบคุมความโค้งของก้าน · สีกลีบ */
const FLOWERS = [
  { x: 40, y: 160, cx: 46, cy: 182, petal: "#f6f1e6" },
  { x: 55, y: 148, cx: 56, cy: 176, petal: "#f2d27a" },
  { x: 71, y: 142, cx: 68, cy: 172, petal: "#c3aee0" },
  { x: 87, y: 151, cx: 80, cy: 178, petal: "#f2b996" },
  { x: 101, y: 167, cx: 88, cy: 186, petal: "#f6f1e6" },
];
const LEAVES = [
  { x: 50, y: 184, r: -48 },
  { x: 60, y: 172, r: -72 },
  { x: 77, y: 176, r: 64 },
  { x: 88, y: 190, r: 28 },
];
const VASE_MOUTH = { x: 64, y: 208 };

/** สันหนังสือยืน: ปก · แถบบนล่าง · ป้ายชื่อเรื่อง · ขอบซ้ายรับแสง · ขอบขวาเงา (พิกัดจากมุมล่างซ้าย ขึ้นด้านบนเป็นค่าลบ) */
function Spine({ w, h, c, b }: { w: number; h: number; c: string; b: string }) {
  return (
    <>
      <rect x={0} y={-h} width={w} height={h} rx={1.5} fill={c} />
      <rect x={0} y={-h + 7} width={w} height={2.5} fill={b} />
      <rect x={0} y={-12} width={w} height={2.5} fill={b} />
      <rect x={w * 0.25} y={-h * 0.62} width={w * 0.5} height={Math.min(16, h * 0.18)} rx={1} fill={b} opacity={0.55} />
      <rect x={0} y={-h} width={1.6} height={h} fill="#fff" opacity={0.16} />
      <rect x={w - 2.4} y={-h} width={2.4} height={h} fill="#000" opacity={0.2} />
    </>
  );
}

/** หนังสือนอน: เห็นสันด้านยาว · แถบใกล้สองปลาย */
function Flat({ x, y, w, h, c, b }: FlatBook) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={c} />
      <rect x={x + 6} y={y} width={2.5} height={h} fill={b} />
      <rect x={x + w - 8.5} y={y} width={2.5} height={h} fill={b} />
      <rect x={x + w * 0.32} y={y + h * 0.3} width={w * 0.36} height={h * 0.4} rx={1} fill={b} opacity={0.5} />
      <rect x={x} y={y + h - 2} width={w} height={2} fill="#000" opacity={0.18} />
    </g>
  );
}

function Plank({ y }: { y: number }) {
  return (
    <g>
      <rect x={6} y={y + 12} width={308} height={9} rx={4} fill="#000" opacity={0.2} filter="url(#shelf-soft)" />
      {[26, 280].map((x) => (
        <path key={x} d={`M${x} ${y + 12}h14l-14 16z`} fill="#3a3d44" />
      ))}
      <rect x={0} y={y} width={320} height={12} rx={2} fill="url(#shelf-oak)" />
      <rect x={0} y={y} width={320} height={2} rx={1} fill="#ffe6be" opacity={0.35} />
    </g>
  );
}

function Blossom({ x, y, petal }: { x: number; y: number; petal: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
        <ellipse key={r} cx={0} cy={-5} rx={2.3} ry={4.6} fill={petal} transform={`rotate(${r})`} />
      ))}
      <circle r={3.2} fill="#e3a93a" />
    </g>
  );
}

export function Bookshelf() {
  return (
    <div aria-hidden className="bookshelf">
      <svg viewBox="0 0 320 300" className="bookshelf-art">
        <defs>
          <linearGradient id="shelf-oak" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#c99b64" />
            <stop offset="0.55" stopColor="#a87542" />
            <stop offset="1" stopColor="#875a2f" />
          </linearGradient>
          <linearGradient id="vase-glaze" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#9dbccd" />
            <stop offset="0.45" stopColor="#6f8fa3" />
            <stop offset="1" stopColor="#4c677b" />
          </linearGradient>
          <filter id="shelf-soft" x="-5%" y="-60%" width="110%" height="220%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* ชั้นบน */}
        <Plank y={UPPER} />
        {UPPER_BOOKS.map((k) => (
          <g key={k.x} transform={`translate(${k.x} ${UPPER})`}>
            <Spine {...k} />
          </g>
        ))}
        {LEANING.map((k) => (
          <g key={k.px} transform={`translate(${k.px} ${UPPER}) rotate(${k.a})`}>
            <Spine {...k} />
          </g>
        ))}
        {UPPER_FLAT.map((k) => (
          <Flat key={k.x} {...k} />
        ))}

        {/* ชั้นล่าง: แจกันดอกไม้ · หนังสือยืน · กองหนังสือนอน */}
        <Plank y={LOWER} />
        <g fill="none" stroke="#5b7f4b" strokeWidth={1.6} strokeLinecap="round">
          {FLOWERS.map((f) => (
            <path key={f.x} d={`M${VASE_MOUTH.x} ${VASE_MOUTH.y}Q${f.cx} ${f.cy} ${f.x} ${f.y}`} />
          ))}
        </g>
        {LEAVES.map((l) => (
          <ellipse key={l.x} cx={l.x} cy={l.y} rx={6.5} ry={2.6} fill="#6f9558" transform={`rotate(${l.r} ${l.x} ${l.y})`} />
        ))}
        {FLOWERS.map((f) => (
          <Blossom key={f.x} x={f.x} y={f.y} petal={f.petal} />
        ))}
        <path
          d="M56 204H72V210C72 214 74 217 78 221C89 230 93 243 90 255C87 264 78 268 64 268C50 268 41 264 38 255C35 243 39 230 50 221C54 217 56 214 56 210Z"
          fill="url(#vase-glaze)"
        />
        <ellipse cx={64} cy={204} rx={8} ry={2.2} fill="#3f5868" />
        <path d="M46 236C43 243 43 251 47 258" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2.5} strokeLinecap="round" />
        {LOWER_BOOKS.map((k) => (
          <g key={k.x} transform={`translate(${k.x} ${LOWER})`}>
            <Spine {...k} />
          </g>
        ))}
        {LOWER_FLAT.map((k) => (
          <Flat key={k.x} {...k} />
        ))}
      </svg>
    </div>
  );
}
