import { Money, MoneyUnit } from "@/frontend/components/money";
import { formatPct } from "@/backend/lib/format";

type Expense = { code: string; name: string; value: number };

/**
 * บัญชีค่าใช้จ่ายดำเนินงาน รวมทุกหน่วยปฏิบัติการ: ยอดรวมอยู่กับที่ด้านบน · ทุกบัญชีเรียงมากไปน้อย (ชื่อเต็ม · ตัวเงิน · % ของรวม)
 * การ์ดจำกัดความสูง (card-lg) — รายการยาวกว่านั้นเลื่อนขึ้นลงใน .card-body · การ์ดโครงสร้างต้นทุนข้างๆ ยืดสูงเท่ากัน
 */
export function TopExpenses({ list }: { list: Expense[] }) {
  const total = list.reduce((t, e) => t + e.value, 0);
  const share = (v: number) => formatPct(total ? (v / total) * 100 : null);

  return (
    <section className="card card-fixed card-lg">
      <h2 className="card-title">ค่าใช้จ่ายดำเนินงานหลัก</h2>
      <p className="card-cap">บัญชีค่าใช้จ่ายขาย บริหาร ค่าเสื่อม และดอกเบี้ย รวมทุกหน่วยปฏิบัติการ (<MoneyUnit long />) · เรียงมากไปน้อย</p>
      {list.length === 0 ? (
        <p className="text-sm text-ink-3">ไม่มีค่าใช้จ่ายในงวดนี้</p>
      ) : (
        <>
          <div className="mb-1 flex items-baseline justify-between gap-3 rounded-(--r-inner) bg-surface-2 px-4 py-3">
            <span className="text-[0.8125rem] text-ink-2">รวม {list.length} บัญชี</span>
            <span className="num text-lg font-semibold"><Money value={total} /></span>
          </div>
          <ol className="card-body scroll-fade"aria-label={`บัญชีค่าใช้จ่ายทั้ง ${list.length} รายการ`}>
            {list.map((e, i) => (
              <li key={e.code} className="grid grid-cols-[1.5rem_1fr_auto_3.25rem] items-baseline gap-x-2 border-b border-line py-2.5 last:border-0">
                <span className="num text-xs text-ink-3">{i + 1}</span>
                <span className="text-[0.8125rem] leading-snug font-semibold">{e.name}</span>
                <span className="num text-right text-[0.8125rem]"><Money value={e.value} /></span>
                <span className="num text-right text-xs text-ink-3">{share(e.value)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
