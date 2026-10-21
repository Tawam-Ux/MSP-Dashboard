import { MONTHS_SHORT, formatBaht, formatBahtDecimal, formatSignedPct } from "@/backend/lib/format";
import type { ComputedLine, Statement } from "@/backend/lib/statement";
import { SignedMoney } from "./money";

type Row = Exclude<ComputedLine, { kind: "heading" }>;
/** ความกว้างข้อความตัวเลขโดยประมาณ หน่วย ch (ตัวเลข tabular กว้าง 1ch · , และ . แคบ · % กว้างกว่า) — แบบเดียวกับ StatementTable */
const textCh = (s: string) => [...s].reduce((w, c) => w + (c === "," || c === "." ? 0.35 : c === "%" ? 1.4 : 1), 0);
const keyOf = (l: Row) => (l.kind === "account" ? `a:${l.code}` : `t:${l.key ?? l.name}`);

/**
 * งบกำไรขาดทุนรายเดือนแบบชีต Monthy: แถว = บรรทัดงบ · คอลัมน์ = ม.ค.–ธ.ค. + รวม
 * ใช้ตรวจเทียบกับไฟล์ได้ตรงๆ · บัญชีที่เป็น 0 ทุกเดือนซ่อน · หัวข้อที่ไม่มีบัญชีเหลือซ่อน · ยอดรวมแสดงเสมอ
 * คอลัมน์ชื่อรายการติดซ้ายตอนเลื่อนแนวนอน · เดือนที่เลือกเน้นทั้งคอลัมน์
 */
export function MonthlyMatrix({
  months, total, current,
}: {
  /** เดือน (1–12) → งบ เฉพาะเดือนที่ปิดงบแล้ว */
  months: Map<number, Statement>;
  total: Statement;
  /** เดือนที่เน้น (null = ไม่เน้น) */
  current: number | null;
}) {
  const values = new Map<number, Map<string, Row>>();
  for (const [m, s] of months) values.set(m, new Map(s.lines.flatMap((l) => (l.kind === "heading" ? [] : [[keyOf(l), l] as const]))));
  const used = (l: Row) => l.kind === "total" || [...values.values()].some((v) => (v.get(keyOf(l))?.value ?? 0) !== 0);

  // โครงแถวจากงบรวม (โครงของงวดล่าสุด) · หัวข้อแสดงเมื่อมีแถวที่ใช้ก่อนถึงหัวข้อถัดไป
  const lines: ComputedLine[] = [];
  total.lines.forEach((l, i) => {
    if (l.kind !== "heading") {
      if (used(l)) lines.push(l);
      return;
    }
    const next = total.lines.slice(i + 1);
    const end = next.findIndex((n) => n.kind === "heading");
    if ((end === -1 ? next : next.slice(0, end)).some((n) => n.kind !== "heading" && used(n))) lines.push(l);
  });

  // ความกว้างคอลัมน์คงที่ (table-layout: fixed) = ข้อความยาวสุดของทั้งยอดเงินและ % — สลับยอด/% หรือเปลี่ยนเดือนแล้วคอลัมน์ไม่ขยับ
  // ยอดแบบทศนิยมยาวกว่า จึงมีความกว้างของตัวเอง (CSS เลือกจาก data-money ของ MoneyProvider)
  const rows = lines.flatMap((l) => (l.kind === "heading" ? [] : [l]));
  const widest = (list: (Row | undefined)[]) => {
    const w = { full: 0, dec: 0 };
    for (const r of list) {
      if (!r) continue;
      const sign = r.value < 0 ? 1 : 0;
      const pct = textCh(formatSignedPct(r.pctOfRevenue));
      w.full = Math.max(w.full, textCh(formatBaht(Math.abs(r.value))) + sign, pct);
      w.dec = Math.max(w.dec, textCh(formatBahtDecimal(Math.abs(r.value))) + sign, pct);
    }
    // +0.6 เผื่อตัวหนาในแถวยอดรวม
    return { full: `${(w.full + 0.6).toFixed(2)}ch`, dec: `${(w.dec + 0.6).toFixed(2)}ch` };
  };
  const monthW = widest(rows.flatMap((l) => [...values.values()].map((v) => v.get(keyOf(l)))));
  const sumW = widest(rows.map((l) => total.lines.find((x) => x.kind !== "heading" && keyOf(x) === keyOf(l)) as Row | undefined));
  const closed = MONTHS_SHORT.filter((_, i) => months.has(i + 1)).length;
  const widths = {
    "--m-w": monthW.full, "--m-w-dec": monthW.dec,
    "--s-w": sumW.full, "--s-w-dec": sumW.dec,
    "--closed": closed, "--open": 12 - closed,
  } as React.CSSProperties;

  // ทุกช่องมีทั้งยอดเงินและ % — การ์ด (MatrixCard) เลือกแสดงด้วย data-show จึงสลับได้ทันทีไม่ต้องโหลด
  const cell = (l: Row | undefined) => {
    if (!l) return <span className="text-ink-3">–</span>;
    return (
      <>
        <span className="mx-amt"><SignedMoney value={l.value} /></span>
        <span className="mx-pct">{formatSignedPct(l.pctOfRevenue)}</span>
      </>
    );
  };

  return (
    <div className="matrix-scroll">
      <table className="matrix" style={widths}>
        <colgroup>
          <col />
          {MONTHS_SHORT.map((name, i) => <col key={name} className={months.has(i + 1) ? "matrix-col" : "matrix-col-off"} />)}
          <col className="matrix-col-sum" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="matrix-name">รายการ</th>
            {MONTHS_SHORT.map((name, i) => (
              <th key={name} scope="col" data-now={current === i + 1 || undefined} data-off={!months.has(i + 1) || undefined}>
                {name}
              </th>
            ))}
            <th scope="col" data-sum>รวม</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            if (l.kind === "heading") {
              return (
                <tr key={i} className="matrix-heading">
                  {/* ช่องเต็มแถว (colspan) ติดซ้ายไม่ได้ — ตัวหนังสือข้างในติดซ้ายแทน เลื่อนแนวนอนแล้วหัวข้อยังอยู่ */}
                  <th scope="colgroup" colSpan={14} className="matrix-name"><span className="matrix-heading-text">{l.name}</span></th>
                </tr>
              );
            }
            const k = keyOf(l);
            const major = l.kind === "total" && l.emphasis === "major";
            const sum = total.lines.find((x) => x.kind !== "heading" && keyOf(x) === k) as Row | undefined;
            return (
              <tr key={i} data-major={major || undefined} data-total={l.kind === "total" || undefined}>
                <th scope="row" className="matrix-name" data-indent={(l.kind === "account" && l.indent) || undefined}>{l.name}</th>
                {MONTHS_SHORT.map((name, mi) => {
                  const v = values.get(mi + 1)?.get(k);
                  return (
                    <td key={name} className="num" data-now={current === mi + 1 || undefined} data-neg={(l.kind === "total" && v && v.value < 0) || undefined}>
                      {months.has(mi + 1) ? cell(v) : <span className="text-ink-3">–</span>}
                    </td>
                  );
                })}
                <td className="num" data-sum data-neg={(l.kind === "total" && sum && sum.value < 0) || undefined}>{cell(sum)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
