"use client";

import Link from "next/link";
import { useActionState, useRef, startTransition } from "react";
import { formatBaht, formatMillions, formatPeriod } from "@/lib/format";
import { uploadWorkbook, type UploadState } from "./actions";

export function UploadForm({ defaultYearBE }: { defaultYearBE: number }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadWorkbook, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  // ส่งเองผ่าน onSubmit เพื่อไม่ให้ฟอร์มล้างไฟล์ที่เลือกไว้หลังตรวจ (ต้องใช้ไฟล์เดิมตอนยืนยัน)
  const submit = (intent: "preview" | "import") => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    data.set("intent", intent);
    startTransition(() => action(data));
  };

  return (
    <div className="max-w-2xl">
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit("preview");
        }}
        className="grid gap-5 sm:grid-cols-[1fr_9rem] sm:items-end"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">ไฟล์ Excel งบกำไรขาดทุนรายเดือน</span>
          <input
            name="file"
            type="file"
            accept=".xlsx"
            required
            className="block w-full rounded-md border border-line-strong bg-surface text-sm file:mr-3 file:border-0 file:bg-plane file:px-3 file:py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">ปี พ.ศ.</span>
          <input
            name="yearBE"
            type="number"
            defaultValue={defaultYearBE}
            required
            className="num w-full rounded-md border border-line-strong bg-surface px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="justify-self-start rounded-md bg-ink px-4 py-2 font-medium text-plane disabled:opacity-60"
        >
          {pending ? "กำลังตรวจไฟล์…" : "ตรวจไฟล์"}
        </button>
      </form>

      <div aria-live="polite" className="mt-8">
        {state.status === "error" && (
          <p role="alert" className="rounded-md border border-loss/40 bg-surface px-4 py-3 text-loss-text">
            {state.message}
          </p>
        )}

        {state.status === "preview" && (
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="font-display text-xl font-semibold">งวด {formatPeriod(state.period)}</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label="หน่วย" value={String(state.unitCount)} />
              <Stat label="รายการข้อมูล" value={formatBaht(state.factCount)} />
              <Stat label="รายได้รวม (ล้าน)" value={formatMillions(state.revenue)} />
              <Stat label="กำไรก่อนภาษี (ล้าน)" value={formatMillions(state.pbt)} />
            </dl>

            {state.mismatches.length > 0 ? (
              <div className="mt-5 text-sm">
                <p className="font-medium text-loss-text">ยอดรวมในไฟล์ไม่ตรงกับผลรวมของหน่วยย่อย {state.mismatches.length} จุด</p>
                <ul className="num mt-2 space-y-1 text-ink-2">
                  {state.mismatches.slice(0, 10).map((m, i) => (
                    <li key={i}>
                      ชีต {m.sheet} บัญชี {m.accountCode}: ในไฟล์ {formatBaht(m.fileTotal)} / รวมจากหน่วย {formatBaht(m.sumOfUnits)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-ink-2">ระบบจะใช้ตัวเลขของหน่วยย่อย ถ้าไม่แน่ใจให้แก้ไฟล์ก่อนนำเข้า</p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-ink-2">ยอดรวมทุกชีตตรงกับผลรวมของหน่วยย่อย</p>
            )}

            {state.replaces && (
              <p className="mt-4 text-sm font-medium">มีข้อมูลงวดนี้อยู่แล้ว การนำเข้าจะแทนที่ข้อมูลเดิมทั้งหมดของงวดนี้</p>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("import")}
              className="mt-5 rounded-md bg-ink px-4 py-2 font-medium text-plane disabled:opacity-60"
            >
              {pending ? "กำลังนำเข้า…" : state.replaces ? "แทนที่ข้อมูลงวดนี้" : "นำเข้าข้อมูล"}
            </button>
          </section>
        )}

        {state.status === "imported" && (
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="font-display text-xl font-semibold">นำเข้างวด {formatPeriod(state.period)} แล้ว</h2>
            <p className="mt-1 text-ink-2">{formatBaht(state.factCount)} รายการ</p>
            <Link href={`/?period=${state.period}`} className="mt-4 inline-block underline">
              ดูภาพรวมงวดนี้
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-2">{label}</dt>
      <dd className="num mt-0.5 text-lg font-medium">{value}</dd>
    </div>
  );
}
