"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatBaht, formatPeriod, formatPeriodRange } from "@/backend/lib/format";
import { discardDraft, importUpload, previewDraft, previewUpload, rememberDraftYear, type ImportResult, type PreviewData } from "./actions";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// สรุปในหน้าตรวจไฟล์แสดงตัวเลขเต็ม 2 ตำแหน่ง ให้เทียบกับ Excel ได้ตรงๆ
const exact = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TOTAL_LABEL: Record<string, string> = { REV: "รายได้รวม", GP: "กำไรขั้นต้น", OP: "กำไรจากการดำเนินงาน", PBT: "กำไร(ขาดทุน) ก่อนภาษี" };

/** เดาปี พ.ศ. จากชื่อไฟล์ เช่น "MSP 2026_08.xlsx" → 2569, "งบ 2569.xlsx" → 2569 */
function yearFromFileName(name: string): number | null {
  const m = name.match(/(?:^|\D)(20\d{2}|25\d{2})(?:\D|$)/);
  if (!m) return null;
  const y = Number(m[1]);
  return y < 2500 ? y + 543 : y;
}

// เรียกเซิร์ฟเวอร์ไม่สำเร็จ (หน้าเว็บเก่ากว่าโค้ดบนเซิร์ฟเวอร์, เน็ตหลุด, เซิร์ฟเวอร์ error) — รายละเอียดอยู่ใน console/terminal
const CALL_FAILED = "ส่งไฟล์ไปที่เซิร์ฟเวอร์ไม่สำเร็จ — รีเฟรชหน้า (F5) แล้วลองใหม่ ถ้ายังไม่ได้ ดูข้อความ error ในหน้าต่าง npm start";

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

type Done = Extract<ImportResult, { ok: true }>;
/** ชีตที่ยอดไม่ตรง: computed = ใช้ยอดที่ระบบคำนวณ · file = ใช้ยอดรวมตามไฟล์ */
type TotalsSource = "computed" | "file";
/** ไฟล์ที่กำลังตรวจ/ค้างอยู่ — ตัวไฟล์จริงอยู่ที่เซิร์ฟเวอร์ (ไฟล์ค้างของผู้ใช้) หน้าเว็บเก็บแค่ชื่อและขนาด */
type FileInfo = { name: string; size: number };

/**
 * draft = ไฟล์ที่ผู้ใช้อัปโหลดค้างไว้ (ตรวจแล้วแต่ยังไม่ยืนยัน) — เปลี่ยนหน้าแล้วกลับมา ไฟล์และสรุปยังอยู่ที่เดิม
 * ไฟล์ค้างหายเมื่อนำเข้าสำเร็จ กดยกเลิก หรือเลือกไฟล์ใหม่
 */
export function UploadForm({ defaultYearBE, draft, aside }: {
  defaultYearBE: number;
  draft: (FileInfo & { yearBE: number }) | null;
  /** การ์ดข้างพื้นที่วางไฟล์ (ไฟล์ที่ใช้อยู่) — จอกว้างวางคู่กัน จอแคบต่อลงมา */
  aside?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<FileInfo | null>(draft ? { name: draft.name, size: draft.size } : null);
  const [yearBE, setYearBE] = useState(draft?.yearBE ?? defaultYearBE);
  // ชีตที่ยอดไม่ตรง: ใช้ยอดที่ระบบคำนวณ (ค่าเริ่มต้น) หรือยอดรวมตามไฟล์
  const [totalsSource, setTotalsSource] = useState<TotalsSource>("computed");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, startReading] = useTransition();
  const [importing, startImporting] = useTransition();

  // กลับมาหน้านี้แล้วมีไฟล์ค้าง: ตรวจไฟล์เดิมที่เซิร์ฟเวอร์ใหม่ (ผังหน่วย/ไฟล์ที่ใช้อยู่อาจเปลี่ยนไประหว่างนั้น)
  const restored = useRef(false);
  useEffect(() => {
    if (!draft || restored.current) return;
    restored.current = true;
    startReading(async () => {
      try {
        const res = await previewDraft();
        if (res === null) setFile(null);
        else if (res.ok) {
          setPreview(res.data);
          setYearBE(res.yearBE);
        } else setError(res.message);
      } catch (e) {
        console.error(e);
        setError(CALL_FAILED);
      }
    });
  }, [draft]);

  // เปลี่ยนปีของไฟล์ → ตรวจใหม่ด้วยข้อมูลหลัก (ผัง Group ตร.ม.) ของปีนั้น
  // รอพิมพ์ครบ 4 หลักแล้วหยุดพิมพ์สักครู่ก่อนตรวจ · ผลของปีที่เปลี่ยนไปแล้วระหว่างรอ ทิ้งไป
  const yearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestYear = useRef(yearBE);
  const changeYear = (y: number) => {
    setYearBE(y);
    latestYear.current = y;
    if (yearTimer.current) clearTimeout(yearTimer.current);
    if (!(Number.isInteger(y) && y >= 2543 && y <= 2643)) return;
    yearTimer.current = setTimeout(() => {
      startReading(async () => {
        try {
          await rememberDraftYear(y);
          const res = await previewDraft();
          if (latestYear.current !== y) return;
          if (res?.ok) setPreview(res.data);
          else if (res) setError(res.message);
        } catch (e) {
          console.error(e);
          setError(CALL_FAILED);
        }
      });
    }, 400);
  };

  // เลือก/วางไฟล์แล้วตรวจไฟล์ทันที ไม่ต้องกดปุ่ม — ไฟล์ที่อ่านได้กลายเป็นไฟล์ค้าง (แทนไฟล์ค้างเดิม)
  const choose = (f: File | undefined) => {
    if (!f) return;
    const guessedYear = yearFromFileName(f.name) ?? defaultYearBE;
    setFile({ name: f.name, size: f.size });
    setPreview(null);
    setError(null);
    setDone(null);
    setYearBE(guessedYear);
    setTotalsSource("computed");
    const data = new FormData();
    data.set("file", f);
    data.set("yearBE", String(guessedYear));
    startReading(async () => {
      try {
        const res = await previewUpload(data);
        if (res.ok) setPreview(res.data);
        else setError(res.message);
      } catch (e) {
        console.error(e);
        setError(CALL_FAILED);
      }
    });
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setDone(null);
    setTotalsSource("computed");
    if (fileRef.current) fileRef.current.value = "";
    discardDraft().catch((e) => console.error(e));
  };

  // นำเข้าไฟล์ค้างที่เซิร์ฟเวอร์ ไม่ต้องส่งไฟล์ซ้ำ
  const confirm = () => {
    if (!file) return;
    const data = new FormData();
    data.set("yearBE", String(yearBE));
    data.set("totalsSource", totalsSource);
    startImporting(async () => {
      try {
        const res = await importUpload(data);
        if (res.ok) {
          setDone(res);
          setPreview(null);
        } else setError(res.message);
      } catch (e) {
        console.error(e);
        setError(CALL_FAILED);
      }
    });
  };

  // ขั้นที่กำลังทำ: 0 เลือกไฟล์ · 1 ตรวจยอด · 2 นำเข้า · 3 เสร็จทุกขั้น
  const step = done ? 3 : importing ? 2 : preview || reading ? 1 : 0;
  const status = reading ? "กำลังอ่านและคำนวณ…" : importing ? "กำลังนำเข้า…" : done ? "นำเข้าแล้ว" : error ? "อ่านไม่สำเร็จ" : preview ? "ตรวจแล้ว · ดูสรุปด้านล่าง" : "";
  const progress = reading || importing ? "busy" : done || preview ? "full" : error ? "error" : "idle";

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      choose(e.dataTransfer.files?.[0]);
    },
  };

  return (
    <div className="space-y-4">
      <div className={`grid gap-4 ${aside ? "lg:grid-cols-[minmax(0,1fr)_21rem]" : ""}`}>
        <section aria-labelledby="upload-title" className="card flex flex-col">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 id="upload-title" className="card-title">นำเข้าไฟล์ Master</h2>
            <Steps current={step} />
          </div>

          <input ref={fileRef} id="master-file" type="file" accept=".xlsx" className="drop-input sr-only" onChange={(e) => choose(e.target.files?.[0])} />
          {/* สูงคงที่ทุกสถานะ (ว่าง · มีไฟล์ · อ่านไม่สำเร็จ) การ์ดจึงไม่ย่อหดขยาย — ข้อความ error อยู่ในกรอบนี้ ไม่ต่อท้ายการ์ด */}
          <label htmlFor="master-file" data-drag={dragging || undefined} {...dropProps} className="drop min-h-64 flex-1">
            {file ? (
              <span key="file" className="flex w-full flex-col justify-center gap-3 px-4 py-4 sm:px-5">
                <span className="flex items-center gap-3.5">
                  <span aria-hidden className="drop-icon size-11!">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M8.5 12.5h7M8.5 16h7M12 12.5V19" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink" title={file.name}>{file.name}</span>
                    <span className="block truncate text-[0.8125rem] text-ink-3" aria-live="polite">
                      {formatSize(file.size)}{status && ` · ${status}`}
                    </span>
                  </span>
                  <span className="drop-cta shrink-0">เปลี่ยนไฟล์</span>
                </span>
                <span aria-hidden className="progress" data-state={progress}><i /></span>
                {error && (
                  <span role="alert" className="flex gap-2 text-sm text-loss-text">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <span className="line-clamp-4" title={error}>{error}</span>
                  </span>
                )}
              </span>
            ) : (
              <span key="empty" className="flex w-full flex-col items-center justify-center px-5 py-6 text-center">
                <span aria-hidden className="drop-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
                  </svg>
                </span>
                <span className="mt-3.5 font-semibold text-ink">{dragging ? "ปล่อยไฟล์เพื่อตรวจ" : "ลากไฟล์ Master มาวางที่นี่"}</span>
                <span className="mt-1 text-sm text-ink-3">ไฟล์ .xlsx · ระบบตรวจยอดให้ก่อน ยังไม่นำเข้าจนกว่าจะยืนยัน</span>
                <span className="drop-cta mt-4">เลือกไฟล์</span>
              </span>
            )}
          </label>

          <p className="mt-3 text-xs text-ink-3">อ่านเฉพาะชีตงบที่แท็บสีน้ำเงินเข้ม (#002060)</p>
        </section>
        {aside}
      </div>

      {/* ตรวจใหม่หลังเปลี่ยนปี: คงสรุปเดิมไว้ (ไม่กระพริบเป็นโครงร่าง) แต่ปุ่มยืนยันรอผลใหม่ */}
      {reading && !preview && <PreviewSkeleton />}
      {preview && (
        <PreviewCard
          data={preview}
          yearBE={yearBE}
          checking={reading}
          onYear={changeYear}
          totalsSource={totalsSource}
          onTotalsSource={setTotalsSource}
          importing={importing}
          onCancel={reset}
          onConfirm={confirm}
        />
      )}
      {done && <DoneCard result={done} onAnother={reset} />}
    </div>
  );
}

function PreviewCard({ data, yearBE, checking, onYear, totalsSource, onTotalsSource, importing, onCancel, onConfirm }: {
  data: PreviewData;
  yearBE: number;
  /** กำลังตรวจใหม่ด้วยข้อมูลหลักของปีที่เพิ่งเปลี่ยน — ยังยืนยันไม่ได้ */
  checking: boolean;
  onYear: (y: number) => void;
  totalsSource: TotalsSource;
  onTotalsSource: (s: TotalsSource) => void;
  importing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const yearOk = Number.isInteger(yearBE) && yearBE >= 2543 && yearBE <= 2643;
  const unitCount = Math.max(0, ...data.months.map((m) => m.unitCount));

  return (
    // overflow-clip (ไม่ใช่ hidden) เพื่อให้แถบปุ่มด้านล่าง sticky ตามจอได้
    <section aria-labelledby="preview-title" className="card overflow-clip p-0!">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5.5 pb-4">
        <div className="min-w-0">
          <h2 id="preview-title" className="card-title">ตรวจยอดก่อนนำเข้า</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3">เทียบตัวเลขกับ Excel แล้วกดยืนยันด้านล่าง</p>
        </div>
        <span className="badge badge-warn badge-dot" title="ไฟล์ค้างไว้ในระบบ เปลี่ยนหน้าแล้วกลับมาได้ จนกว่าจะยืนยันหรือยกเลิก">
          ยังไม่ได้นำเข้า
        </span>
      </div>

      {/* 5 ช่อง: จอแคบ 2 คอลัมน์ ช่องสุดท้ายเต็มแถว */}
      <dl className="mx-5 grid grid-cols-2 overflow-hidden rounded-[22px] bg-surface-2 sm:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <Stat
          label={`${data.months.length} เดือน`}
          value={yearOk ? formatPeriodRange(data.months.map((m) => `${yearBE - 543}-${String(m.month).padStart(2, "0")}-01`)) : "—"}
        />
        <Stat label="หน่วยที่มียอด" value={formatBaht(unitCount)} />
        <Stat label="ยอดราย Group" value={formatBaht(data.rowCount)} />
        <Stat label="รอเลือกประเภท" value={String(data.pendingUnits.length)} tone={data.pendingUnits.length ? "warn" : undefined} />
        <Stat
          label="พื้นที่ ตร.ม."
          value={data.areaSheet ? `${data.areaSheet.count} สาขา` : "ใช้ชุดเดิม"}
          tone={!data.areaSheet || data.areaSheet.issues.length + data.areaSheet.unknownCodes.length > 0 ? "warn" : undefined}
        />
      </dl>

      <div className="space-y-6 px-6 py-5">
        <Issues data={data} totalsSource={totalsSource} onTotalsSource={onTotalsSource} disabled={importing} />

        {/* ยอดที่ backend คำนวณแล้ว ให้เทียบกับชีตงบรวมใน Excel */}
        <div>
          <h3 className="text-sm font-semibold text-ink">ยอดรวมทั้งบริษัท <span className="font-normal text-ink-3">(บาท)</span></h3>
          <div className="relative mt-2.5 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>เดือน</th>
                  <th className="text-right!">รายได้รวม</th>
                  <th className="text-right!">กำไรขั้นต้น</th>
                  <th className="text-right!">กำไรจากการดำเนินงาน</th>
                  <th className="text-right!">กำไร(ขาดทุน) ก่อนภาษี</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month}>
                    <td className="font-medium">{MONTHS[m.month - 1]}</td>
                    <Money value={m.rev} />
                    <Money value={m.gp} />
                    <Money value={m.op} />
                    <Money value={m.pbt} bold />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
        {checking ? (
          <p className="min-w-0 max-w-xl text-[0.8125rem] text-ink-2" role="status">กำลังตรวจใหม่ด้วยข้อมูลหลักของปี {yearBE}…</p>
        ) : (
          <ImportTarget activeFiles={data.activeFiles} masterYearsBE={data.masterYearsBE} yearBE={yearOk ? yearBE : null} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            ปี พ.ศ.
            <input type="number" value={yearBE} onChange={(e) => onYear(Number(e.target.value))} aria-invalid={!yearOk} className="field num w-28!" />
          </label>
          <button type="button" onClick={onCancel} disabled={importing} className="btn-soft min-h-11 px-5! text-sm!">
            ยกเลิก
          </button>
          <button type="button" onClick={onConfirm} disabled={importing || checking || !yearOk} aria-busy={importing || checking} className="btn-primary">
            {/* ข้อความสองแบบซ้อนกัน ปุ่มกว้างเท่าเดิมทั้งก่อนและระหว่างนำเข้า */}
            <span className="swap">
              <span data-on={!importing || undefined}>ยืนยันนำเข้า</span>
              <span data-on={importing || undefined} className="inline-flex items-center justify-center gap-2"><Spinner />กำลังนำเข้า…</span>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

type Issue = { key: string; tone: "bad" | "warn" | "muted"; title: string; count: string; body: React.ReactNode };

/**
 * สิ่งที่ควรตรวจก่อนนำเข้า: แถวละเรื่อง (หัวข้อสั้น + จำนวน) ตามด้วยรายละเอียด
 * ไม่มีเรื่องให้ตรวจ = แสดงบรรทัดยืนยันว่าไฟล์ผ่าน
 */
function Issues({ data, totalsSource, onTotalsSource, disabled }: {
  data: PreviewData;
  totalsSource: TotalsSource;
  onTotalsSource: (s: TotalsSource) => void;
  disabled: boolean;
}) {
  const tree = data.unitTree;
  const items: Issue[] = [];

  if (data.mismatches.length > 0) {
    items.push({
      key: "mismatch", tone: "bad", title: "ยอดรวมไม่ตรงกับไฟล์", count: `${data.mismatches.length} รายการ`,
      body: <MismatchPanel mismatches={data.mismatches} totalsSource={totalsSource} onTotalsSource={onTotalsSource} disabled={disabled} />,
    });
  }
  if (data.pendingUnits.length > 0) {
    items.push({
      key: "pending", tone: "warn", title: "หน่วยงานที่ยังไม่ได้เลือกประเภท", count: `${data.pendingUnits.length} หน่วย`,
      body: (
        <>
          <p className="text-ink-2">ยอดถูกเก็บไว้แต่ยังไม่นับใน Dashboard — เลือก Sales Zone หรือ Operations ในแอปหลังบ้าน (เมนู หน่วยงานใหม่)</p>
          <ul className="mt-2.5 space-y-1.5">
            {data.pendingUnits.map((u) => (
              <li key={u.code} className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono font-semibold text-ink">{u.code}</span>
                <span className="text-ink">{u.name}</span>
                <span className="text-ink-3">ชีต {u.sheet}</span>
                {u.isNew && <span className="badge badge-warn">ใหม่</span>}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }
  if (tree.added.length + tree.removed.length + tree.updated.length > 0) {
    items.push({
      key: "tree", tone: "warn", title: "ผังหน่วยจะถูกแทนด้วยผังใหม่",
      count: [tree.added.length && `เพิ่ม ${tree.added.length}`, tree.removed.length && `ลบ ${tree.removed.length}`, tree.updated.length && `แก้ ${tree.updated.length}`].filter(Boolean).join(" / "),
      body: (
        <>
          <p className="text-ink-2">เพิ่ม {tree.added.length} · ลบ {tree.removed.length} · แก้ชื่อหรือตำแหน่ง {tree.updated.length} หน่วย</p>
          {tree.removed.length > 0 && (
            <>
              <p className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-ink-3">หน่วยที่ลบ</span>
                {tree.removed.map((c) => <span key={c} className="badge badge-bad font-mono">{c}</span>)}
              </p>
              <p className="mt-2 text-ink-3">สิทธิ์ผู้ใช้ของ CMI-SHOP / NAN / SU ย้ายไป Sz-CMI / Zone-NAN / Zone-SU · หน่วยอื่นที่ลบ สิทธิ์ถูกลบด้วย</p>
            </>
          )}
        </>
      ),
    });
  }
  if (data.unknownGroups.length > 0) {
    items.push({
      key: "groups", tone: "warn", title: "Group ใหม่ที่ยังไม่ได้เลือกหมวด", count: `${data.unknownGroups.length} Group`,
      body: (
        <>
          <p className="text-ink-2">
            ยอดถูกเก็บไว้แต่ยังไม่นับในงบ — เลือกว่าเป็นต้นทุนหรือค่าใช้จ่ายในแอปหลังบ้าน (เมนู Group ใหม่)
            {data.pendingGroupsUrl && (
              <>
                {" · "}
                <a href={data.pendingGroupsUrl} className="font-medium text-accent underline-offset-2 hover:underline">ไปเลือกหมวด</a>
              </>
            )}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {data.unknownGroups.map((g) => (
              <li key={g.group} className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono font-semibold text-ink">{g.group}</span>
                <span className="text-ink">{g.name}</span>
                <span className="num text-ink-3">ยอดรวม {exact.format(g.amount)} บาท</span>
                {g.isNew && <span className="badge badge-warn">ใหม่</span>}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }
  if (data.missingUnits.length > 0) {
    items.push({
      key: "missing", tone: "muted", title: "หน่วยในผังที่ไม่พบในชีตงบ", count: `${data.missingUnits.length} หน่วย`,
      body: (
        <>
          <p className="text-ink-2">หน่วยเหล่านี้จะไม่มีตัวเลขในเดือนที่นำเข้า</p>
          <p className="mt-2 flex flex-wrap gap-1.5">{data.missingUnits.map((c) => <span key={c} className="badge badge-muted font-mono">{c}</span>)}</p>
        </>
      ),
    });
  }
  // ชีต Branch_Area (พื้นที่ ตร.ม. ใช้คิดเกณฑ์รายได้ต่อ ตร.ม. ของ Sales Zone)
  const area = data.areaSheet;
  if (!area) {
    items.push({
      key: "area-missing", tone: "muted", title: "ไม่มีชีต Branch_Area", count: `ใช้ ตร.ม. ชุดเดิม ${data.savedAreaCount} สาขา`,
      body: (
        <p className="text-ink-2">
          {data.savedAreaCount > 0
            ? "เกณฑ์รายได้ต่อ ตร.ม. ของ Sales Zone คิดจากพื้นที่ที่บันทึกไว้จากไฟล์ก่อนหน้า (แก้ได้ในแอปหลังบ้าน เมนู Branch Area)"
            : "ยังไม่มีข้อมูลพื้นที่ ตร.ม. ในระบบ — หน้า Sales Zone จะยังไม่มีเกณฑ์รายได้ต่อ ตร.ม. จนกว่าจะนำเข้าไฟล์ที่มีชีต Branch_Area"}
        </p>
      ),
    });
  } else if (area.issues.length + area.unknownCodes.length > 0) {
    items.push({
      key: "area-issues", tone: "warn", title: "ชีต Branch_Area มีแถวที่ต้องตรวจ", count: `${area.issues.length + area.unknownCodes.length} รายการ`,
      body: (
        <>
          <p className="text-ink-2">อ่านพื้นที่ได้ {area.count} สาขา · นำเข้าแล้วแทน ตร.ม. ชุดเดิมทั้งหมด</p>
          {area.issues.length > 0 && (
            <ul className="mt-2.5 space-y-1 text-ink">
              {area.issues.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
          {area.unknownCodes.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-ink-3">รหัสที่ไม่อยู่ในผังหน่วย (ไม่ถูกใช้คิดเกณฑ์)</span>
              {area.unknownCodes.map((c) => <span key={c} className="badge badge-muted font-mono">{c}</span>)}
            </p>
          )}
        </>
      ),
    });
  }
  if (data.areaChanges.length > 0) {
    const ch = data.areaChanges;
    const edited = ch.filter((c) => c.before != null && c.after != null).length;
    const added = ch.filter((c) => c.before == null).length;
    const removed = ch.filter((c) => c.after == null).length;
    items.push({
      key: "area-changes", tone: "warn", title: "พื้นที่ ตร.ม. เปลี่ยนจากชุดที่ใช้อยู่",
      count: [edited && `แก้ ${edited}`, added && `เพิ่ม ${added}`, removed && `ลบ ${removed}`].filter(Boolean).join(" / "),
      body: <AreaChangesPanel changes={ch} basisPeriod={data.areaBasisPeriod} />,
    });
  }
  // ชีต Monthy (ภาพรวมบริษัทของหน้า Overview)
  const monthy = data.monthy;
  if (!monthy) {
    items.push({
      key: "monthy-missing", tone: "warn", title: "ไม่มีชีต Monthy", count: "หน้า Overview ใช้ข้อมูลชุดเดิม",
      body: <p className="text-ink-2">หน้า Overview อ่านภาพรวมทั้งบริษัทจากชีต Monthy — ไฟล์นี้ไม่มีชีตนี้ นำเข้าแล้ว Overview ของปีนี้ยังแสดงตัวเลขจากไฟล์ก่อนหน้า (ถ้าไม่มี ใช้งบของหน่วย MSP แทน)</p>,
    });
  } else if (monthy.diffs.length + monthy.mismatches.length + monthy.missingMonths.length + monthy.issues.length > 0) {
    const label: Record<string, string> = { REV: "รายได้รวม", GP: "กำไรขั้นต้น", OP: "กำไรจากการดำเนินงาน", PBT: "กำไรก่อนภาษี" };
    items.push({
      key: "monthy", tone: "warn", title: `ชีต ${monthy.sheet} ต้องตรวจ`,
      count: `${monthy.diffs.length + monthy.mismatches.length + monthy.missingMonths.length + monthy.issues.length} รายการ`,
      body: (
        <>
          <p className="text-ink-2">หน้า Overview แสดงตัวเลขตามชีต {monthy.sheet} — รายการด้านล่างต่างจากงบรวมของชีตรายเดือน</p>
          <ul className="mt-2.5 space-y-1.5 text-ink">
            {monthy.diffs.map((d) => (
              <li key={`d-${d.month}-${d.key}`}>
                {MONTHS[d.month - 1]} · {label[d.key]}: Monthy <span className="num">{exact.format(d.monthy)}</span> · งบรวม <span className="num">{exact.format(d.master)}</span>
              </li>
            ))}
            {monthy.mismatches.map((d) => (
              <li key={`m-${d.month}-${d.key}`}>
                {MONTHS[d.month - 1]} · แถว{label[d.key]}ในชีต <span className="num">{exact.format(d.file)}</span> ไม่ตรงกับผลรวมราย Group <span className="num">{exact.format(d.computed)}</span>
              </li>
            ))}
            {monthy.missingMonths.length > 0 && <li>ชีต {monthy.sheet} ไม่มีตัวเลขของ {monthy.missingMonths.map((m) => MONTHS[m - 1]).join(", ")} — Overview จะไม่แสดงเดือนเหล่านี้</li>}
            {monthy.issues.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </>
      ),
    });
  }
  if (data.emptyMonths.length > 0) {
    items.push({
      key: "empty", tone: "muted", title: "ข้ามเดือนที่ยอดเป็น 0", count: data.emptyMonths.map((m) => MONTHS[m - 1]).join(", "),
      body: <p className="text-ink-2">ชีตร่าง หรือไฟล์ไม่ได้บันทึกจาก Excel หลังคำนวณ — เปิดไฟล์ใน Excel แล้วบันทึกใหม่ถ้าเดือนนี้ควรมีตัวเลข</p>,
    });
  }

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2.5 rounded-[18px] bg-(--ok-soft) px-4 py-3 text-sm text-ink-2">
        <span aria-hidden className="grid size-5 place-items-center rounded-full bg-(--ok-soft) text-(--ok)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
        </span>
        ยอดรวมตรงกับไฟล์ ไม่มีรายการที่ต้องตรวจเพิ่ม
      </p>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">สิ่งที่ควรตรวจ</h3>
      <ul className="issues mt-2.5">
        {/* แสดงรายละเอียดทุกเรื่องเสมอ (ไม่มีพับ/กาง) การ์ดจึงไม่ย่อหดขยายเมื่อกด */}
        {items.map((it) => (
          <li key={it.key} className="issue">
            <h4 className="issue-head">
              <span aria-hidden className="issue-dot" data-tone={it.tone} />
              <span className="font-medium text-ink">{it.title}</span>
              <span className="truncate text-[0.8125rem] font-normal text-ink-3">{it.count}</span>
            </h4>
            <div className="px-4 pb-4 pl-9 text-sm">{it.body}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SOURCE_OPTIONS: { value: TotalsSource; label: string; note: string; recommended?: boolean }[] = [
  { value: "computed", label: "ตัวเลขที่ระบบคำนวณ", note: "คิดจากยอดราย Group ของทุกสาขา — งบทุกบรรทัดสอดคล้องกัน", recommended: true },
  { value: "file", label: "ยอดรวมตามไฟล์", note: "ใช้กับหน่วยในคอลัมน์ \"ใช้กับ\" — บรรทัดอื่นยังคิดจากยอดราย Group" },
];

/** ลำดับความสำคัญของยอดรวม — ตัวเลขหลักบนการ์ดตัวเลือกเลือกจากบรรทัดท้ายงบก่อน */
const TOTAL_RANK: Record<string, number> = { PBT: 0, OP: 1, GP: 2, REV: 3 };

const signed = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });

/**
 * การ์ดยอดไม่ตรง: ตารางจัดกลุ่มตามชีต (ตามไฟล์ · ระบบ · ส่วนต่าง · ใช้กับ) ตัวเลขชิดขวาเทียบหลักได้
 * แล้วเลือกแหล่งตัวเลขด้วยการ์ดตัวเลือก (SourceChoice) ที่บอกตัวเลขที่จะได้ของแต่ละแบบ
 */
function MismatchPanel({ mismatches, totalsSource, onTotalsSource, disabled }: {
  mismatches: PreviewData["mismatches"];
  totalsSource: TotalsSource;
  onTotalsSource: (s: TotalsSource) => void;
  disabled: boolean;
}) {
  // จัดกลุ่มตามเดือน+ชีต (ลำดับตามที่ระบบตรวจ) ชื่อชีตแสดงครั้งเดียวต่อกลุ่ม
  const groups = new Map<string, PreviewData["mismatches"]>();
  for (const m of mismatches) groups.set(`${m.month}|${m.sheet}`, [...(groups.get(`${m.month}|${m.sheet}`) ?? []), m]);

  return (
    <div>
      <p className="text-ink-2">ตรวจสูตรในชีตงบ แล้วเลือกตัวเลขที่จะนำเข้า</p>

      <div className="relative mt-2.5 overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>ชีต</th>
              <th>รายการ</th>
              <th className="text-right!">ตามไฟล์</th>
              <th className="text-right!">ระบบคำนวณ</th>
              <th className="text-right!">ส่วนต่าง</th>
              <th>ใช้กับ</th>
            </tr>
          </thead>
          <tbody>
            {[...groups.values()].map((rows) =>
              rows.map((m, i) => (
                <tr key={`${m.month}-${m.sheet}-${m.key}`}>
                  {i === 0 && (
                    <th scope="rowgroup" rowSpan={rows.length} className="align-top font-semibold whitespace-nowrap text-ink">
                      {m.sheet}
                    </th>
                  )}
                  <td className="whitespace-nowrap text-ink-2">{TOTAL_LABEL[m.key] ?? m.key}</td>
                  <td className="num text-right whitespace-nowrap text-ink">{exact.format(m.file)}</td>
                  <td className="num text-right whitespace-nowrap text-ink-2">{exact.format(m.computed)}</td>
                  <td className="num text-right font-medium whitespace-nowrap text-loss-text">{signed.format(m.file - m.computed)}</td>
                  {i === 0 && (
                    <td rowSpan={rows.length} className="align-top text-[0.8125rem] text-ink-2">
                      {m.targets.length ? (
                        <span className="flex flex-wrap gap-1">
                          {m.targets.map((t) => <span key={t.code} className="badge badge-muted">{t.name}</span>)}
                        </span>
                      ) : (
                        <span className="text-ink-3">ไม่มีหน่วยที่ตรงกับชีตนี้</span>
                      )}
                    </td>
                  )}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <SourceChoice mismatches={mismatches} value={totalsSource} onChange={onTotalsSource} disabled={disabled} />
    </div>
  );
}

const sqmFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const sqmSigned = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
const pctSigned = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, signDisplay: "exceptZero" });

/**
 * ตร.ม. ที่จะเปลี่ยนเมื่อนำเข้า: เทียบกับชุดที่ใช้อยู่ (ไฟล์ Master ปัจจุบัน ข้อมูลถึงเดือน basisPeriod หรือค่าที่แก้ในแอปหลังบ้าน)
 * แสดง เดิม → ใหม่ และส่วนต่างเป็น ตร.ม. กับ %
 */
function AreaChangesPanel({ changes, basisPeriod }: { changes: PreviewData["areaChanges"]; basisPeriod: string | null }) {
  const basis = basisPeriod ? formatPeriod(basisPeriod, "short") : null;
  return (
    <div>
      <p className="text-ink-2">
        เทียบกับ ตร.ม. ที่ใช้อยู่{basis ? ` (ไฟล์เดือน ${basis})` : ""} — นำเข้าแล้วใช้ค่าใหม่ คิดเกณฑ์รายได้ต่อ ตร.ม. ใหม่ทุกเดือน
      </p>
      <div className="relative mt-2.5 overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>สาขา</th>
              <th className="text-right!">เดิม{basis ? ` (${basis})` : ""}</th>
              <th className="text-right!">ใหม่</th>
              <th className="text-right!">เปลี่ยน</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.code}>
                <th scope="row" className="text-left! font-normal whitespace-nowrap">
                  <span className="font-mono font-semibold text-ink">{c.code}</span>
                  {c.name && <span className="ml-2 text-ink-2">{c.name}</span>}
                  {c.source === "admin" && <span className="badge badge-muted ml-2">แก้ในหลังบ้าน</span>}
                </th>
                <td className="num text-right whitespace-nowrap text-ink-2">{c.before == null ? "—" : sqmFmt.format(c.before)}</td>
                <td className="num text-right whitespace-nowrap text-ink">{c.after == null ? "—" : sqmFmt.format(c.after)}</td>
                <td className="num text-right font-medium whitespace-nowrap text-ink">
                  {c.before == null ? (
                    <span className="badge badge-warn">สาขาใหม่</span>
                  ) : c.after == null ? (
                    <span className="badge badge-bad">ไม่มีในไฟล์ — ลบ</span>
                  ) : (
                    <>
                      {sqmSigned.format(c.after - c.before)} ตร.ม.
                      {c.before > 0 && <span className="ml-1.5 text-ink-3">({pctSigned.format(((c.after - c.before) / c.before) * 100)}%)</span>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * เลือกแหล่งตัวเลขที่จะนำเข้า: การ์ดตัวเลือกสองใบ แต่ละใบบอก "ตัวเลขที่จะได้" จริงของรายการหลัก ให้เห็นผลก่อนเลือก
 * รายการหลัก = ยอดที่ไม่ตรงบรรทัดท้ายสุดของงบ (กำไรก่อนภาษี → … → รายได้) ที่ยอดใหญ่สุด (มักเป็นชีตงบรวม) · รายการอื่นอยู่ในตารางด้านบน
 * ตัวที่เลือก = ขอบเข้ม + วงกลมทึบ (ไม่พึ่งสีอย่างเดียว) · ใช้ <input type="radio"> จริง: คลิกตรงไหนของการ์ดก็ได้ · Tab แล้วลูกศรสลับ
 */
function SourceChoice({ mismatches, value, onChange, disabled }: {
  mismatches: PreviewData["mismatches"];
  value: TotalsSource;
  onChange: (s: TotalsSource) => void;
  disabled: boolean;
}) {
  const lead = [...mismatches].sort((a, b) => (TOTAL_RANK[a.key] ?? 9) - (TOTAL_RANK[b.key] ?? 9) || Math.abs(b.file) - Math.abs(a.file))[0];
  const sheets = new Set(mismatches.map((m) => `${m.month}|${m.sheet}`)).size;
  const others = mismatches.length - 1;

  return (
    <fieldset className="mt-4" disabled={disabled}>
      <legend className="mb-2 text-[0.8125rem] font-medium text-ink">นำเข้าด้วยตัวเลขแบบไหน</legend>
      <div className="grid max-w-3xl gap-2.5 sm:grid-cols-2">
        {SOURCE_OPTIONS.map((o) => {
          const checked = o.value === value;
          const amount = lead ? (o.value === "file" ? lead.file : lead.computed) : null;
          return (
            <label
              key={o.value}
              className={`flex gap-3 rounded-[18px] border bg-surface p-4 transition-[border-color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--focus) ${
                checked ? "border-(--pill) shadow-[inset_0_0_0_1px_var(--pill)]" : "border-line hover:border-(--line-strong)"
              } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input type="radio" name="totals-source" value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              {/* วงกลมตัวเลือก: เลือกแล้วขอบเข้ม + จุดกลาง */}
              <span
                aria-hidden
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 ${checked ? "border-(--pill)" : "border-(--line-strong)"}`}
              >
                <span className={`size-2.5 rounded-full bg-(--pill) transition-transform duration-150 ${checked ? "scale-100" : "scale-0"}`} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-sm text-ink ${checked ? "font-semibold" : "font-medium"}`}>{o.label}</span>
                  {o.recommended && <span className="badge badge-good">แนะนำ</span>}
                </span>
                {lead && amount != null && (
                  <span className="mt-2.5 block">
                    <span className="block text-xs text-ink-3">{TOTAL_LABEL[lead.key] ?? lead.key} · ชีต {lead.sheet}</span>
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                      <span className="num text-lg leading-tight font-semibold text-ink">{exact.format(amount)}</span>
                      {o.value === "file" && (
                        <span className="num text-[0.8125rem] font-medium text-(--warn-text)">{signed.format(lead.file - lead.computed)} จากระบบ</span>
                      )}
                    </span>
                  </span>
                )}
                <span className="mt-2 block text-[0.8125rem] leading-snug text-pretty text-ink-2">{o.note}</span>
              </span>
            </label>
          );
        })}
      </div>
      {others > 0 && (
        <p className="mt-2 text-xs text-ink-3">ไม่ตรงทั้งหมด {mismatches.length} รายการใน {sheets} ชีต — ทุกรายการในตารางด้านบนจะใช้ตัวเลขตามที่เลือก</p>
      )}
    </fieldset>
  );
}
function Money({ value, bold = false }: { value: number; bold?: boolean }) {
  return <td className={`num text-right ${bold ? "font-semibold" : ""} ${value < 0 ? "text-loss-text" : ""}`}>{exact.format(value)}</td>;
}

function DoneCard({ result, onAnother }: { result: Done; onAnother: () => void }) {
  return (
    <section role="status" className="card">
      <div className="flex flex-wrap items-start gap-4">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-(--ok-soft) text-(--ok)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="card-title">นำเข้าแล้ว — Dashboard ใช้ข้อมูลชุดนี้</h2>
          <p className="num mt-0.5 text-sm text-ink-2">
            {formatPeriodRange(result.periods)} ({result.periods.length} เดือน) · {formatBaht(result.lineCount)} แถว
            {result.unitTree.added.length + result.unitTree.removed.length + result.unitTree.updated.length > 0 &&
              ` · ผังหน่วย เพิ่ม ${result.unitTree.added.length} ลบ ${result.unitTree.removed.length} แก้ ${result.unitTree.updated.length}`}
          </p>

          {result.backups.map((b) =>
            b.ok ? (
              <p key={b.id} className="mt-3 flex items-center gap-1.5 text-sm text-ink-2">
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-(--ok)"><path d="M5 12l5 5L20 7" /></svg>
                <span className="min-w-0">ย้าย <span className="break-all text-ink">{b.fileName}</span> ไปเก็บที่ Google Drive แล้ว</span>
              </p>
            ) : (
              <div key={b.id} className="panel panel-warn mt-3 text-sm">
                <p className="font-semibold text-(--warn-text)">ไฟล์เดิม {b.fileName} ยังไม่ได้ backup</p>
                <p className="mt-0.5 text-ink-2">{b.error} · ไฟล์เก็บไว้ในเครื่องแล้ว กด &quot;ส่งขึ้น Drive อีกครั้ง&quot; ในประวัติการนำเข้า</p>
              </div>
            ),
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/?period=${result.periods[result.periods.length - 1]}`} className="btn-primary">ดูภาพรวมเดือนล่าสุด</Link>
            <button type="button" onClick={onAnother} className="btn-soft min-h-11 px-5! text-sm!">
              นำเข้าไฟล์อื่น
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewSkeleton() {
  return (
    <section role="status" aria-busy="true" className="card overflow-clip p-0!">
      <span className="sr-only">กำลังอ่านไฟล์…</span>
      <div className="px-6 pt-5.5 pb-4">
        <span aria-hidden className="skel block h-4 w-44" />
        <span aria-hidden className="skel mt-2 block h-3 w-64 max-w-full" />
      </div>
      <div className="mx-5 grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-line sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="block bg-surface-2 px-5 py-3">
            <span aria-hidden className="skel block h-3 w-16" />
            <span aria-hidden className="skel mt-2 block h-5 w-24" />
          </span>
        ))}
      </div>
      <div className="space-y-2.5 px-5 py-5">
        {Array.from({ length: 4 }, (_, i) => <span key={i} aria-hidden className="skel block h-3.5 w-full" />)}
      </div>
    </section>
  );
}

/** บอกผลของการนำเข้าตามปี พ.ศ. ที่เลือก: แทนไฟล์ปีเดียวกัน / เพิ่มปีใหม่ (ปีอื่นไม่เปลี่ยน) / ไฟล์แรก */
function ImportTarget({ activeFiles, masterYearsBE, yearBE }: { activeFiles: PreviewData["activeFiles"]; masterYearsBE: number[]; yearBE: number | null }) {
  const same = activeFiles.find((f) => f.yearBE === yearBE);
  const others = activeFiles.filter((f) => f.yearBE !== yearBE).map((f) => f.yearBE).sort((a, b) => a - b);
  const keep = others.length > 0 && <span className="block text-ink-3">ข้อมูลปี {others.join(", ")} ไม่เปลี่ยน</span>;
  return (
    <p className="min-w-0 max-w-xl text-[0.8125rem] text-ink-2">
      {yearBE == null ? (
        "ใส่ปี พ.ศ. ของไฟล์ก่อนนำเข้า"
      ) : same ? (
        <>
          แทนข้อมูลปี {yearBE} จากไฟล์ <span className="font-medium break-all text-ink">{same.fileName}</span>
          <span className="block text-ink-3">ไฟล์เดิมย้ายไปเก็บที่ Google Drive</span>
          {keep}
        </>
      ) : others.length > 0 ? (
        <>
          เพิ่มข้อมูลปี {yearBE} เข้าระบบ
          <MasterSource masterYearsBE={masterYearsBE} yearBE={yearBE} />
          {keep}
        </>
      ) : (
        "ไฟล์นี้จะเป็นไฟล์ Master ไฟล์แรกของระบบ"
      )}
    </p>
  );
}

/** ข้อมูลหลักที่ปีนี้จะใช้: มีอยู่แล้ว / สำเนาจากปีต้นแบบ (เหมือน ensureYear: ปีก่อนหน้าที่ใกล้ที่สุด ไม่มี = ปีถัดไปที่ใกล้ที่สุด) */
function MasterSource({ masterYearsBE, yearBE }: { masterYearsBE: number[]; yearBE: number }) {
  const sorted = [...masterYearsBE].sort((a, b) => a - b);
  const source = sorted.includes(yearBE) ? null : ([...sorted].reverse().find((y) => y < yearBE) ?? sorted.find((y) => y > yearBE));
  return (
    <span className="block text-ink-3">
      {source ? `ผังหน่วย Group และ ตร.ม. เริ่มจากสำเนาของปี ${source}` : `ใช้ผังหน่วย Group และ ตร.ม. ของปี ${yearBE} ที่มีอยู่`}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="border-line px-5 py-3 not-last:border-r max-sm:nth-2:border-r-0 max-sm:nth-[-n+2]:border-b">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`num mt-0.5 font-display text-lg font-semibold ${tone === "warn" ? "text-(--warn-text)" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

const STEPS = ["เลือกไฟล์", "ตรวจยอด", "นำเข้า"];

/** ขั้นตอนนำเข้า — current = ขั้นที่กำลังทำ (3 = เสร็จทุกขั้น) · จอแคบแสดงชื่อเฉพาะขั้นปัจจุบัน */
function Steps({ current }: { current: number }) {
  return (
    <ol className="steps w-full sm:w-auto sm:min-w-[22rem]" aria-label="ขั้นตอนการนำเข้า">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="step-dot num">
              {state === "done" ? (
                <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="step-label">
              {label}
              {state === "done" && <span className="sr-only"> (เสร็จแล้ว)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Spinner() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin motion-reduce:animate-none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
