// สัดส่วนกรอบโลโก้ (viewBox) — กว้าง:สูง
const VB = { x: 0, y: -6, w: 200, h: 90 };

/**
 * โลโก้ MSP Interfood (เวกเตอร์) — ตัวอักษร MSP เอียงเส้นหนามุมแหลม + กราฟแท่งขาขึ้นกับเส้นลูกศรเติบโต
 * สีมาจากตัวแปรธีม (--line-msp, --ink, --ink-3) จึงเปลี่ยนตามธีมสว่าง/มืดเอง
 * ตัว MSP ชุดเดียวกับ public/icon.svg; size = ความสูงเป็น px ความกว้างตามสัดส่วน
 */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      width={Math.round((size * VB.w) / VB.h)}
      height={size}
      className={`logo-mark ${className}`}
      role="img"
      aria-label="MSP Interfood Co.,Ltd"
    >
      <g transform="translate(8 0) skewX(-12)" fill="none" stroke="var(--line-msp)" strokeWidth={9} strokeMiterlimit={10}>
        <path d="M6 48V13L22 31L38 13V48" />
        <path d="M82 12.5H60a7.75 7.75 0 0 0 0 15.5H70a7.75 7.75 0 0 1 0 15.5H48" />
        <path d="M92 48V12.5H108a7.75 7.75 0 0 1 0 15.5H96" />
      </g>
      <g fill="var(--ink-3)" opacity={0.7}>
        <rect x={133} y={38} width={6} height={10} rx={1.5} />
        <rect x={143} y={31} width={6} height={17} rx={1.5} />
        <rect x={153} y={23} width={6} height={25} rx={1.5} />
        <rect x={163} y={14} width={6} height={34} rx={1.5} />
      </g>
      <path d="M6 60C60 62 140 52 185 15" fill="none" stroke="var(--line-msp)" strokeWidth={4} strokeLinecap="round" />
      <path d="M192.5 9L188 20.5L180.5 11Z" fill="var(--line-msp)" stroke="var(--line-msp)" strokeWidth={2} strokeLinejoin="round" />
      <text
        x={100}
        y={80}
        textAnchor="middle"
        textLength={184}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-body), sans-serif"
        fontWeight={700}
        fontSize={18}
        fill="var(--ink)"
      >
        Interfood Co.,Ltd
      </text>
    </svg>
  );
}
