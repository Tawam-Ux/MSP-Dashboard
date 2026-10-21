// ข้อความตัวเลือกโซน/ประเภท (ข้อมูลจากหน้า แก้ไขฐานข้อมูล) ใช้ร่วมในฟอร์มหน่วยทุกหน้า

export const PAGE_LABEL: Record<string, string> = { sales: "Sales Zone", operations: "Operations" };

/** ประเภท: ชื่อ + หน้าที่แสดง เช่น "ค้าส่ง — แสดงหน้า Operations" */
export const categoryOption = (c: { name: string; page: string }) => `${c.name} — แสดงหน้า ${PAGE_LABEL[c.page] ?? c.page}`;

/** โซน: ชื่อในผัง + ชื่อภาษาไทย เช่น "Zone-CMI · โซนเชียงใหม่" */
export const zoneOption = (z: { name: string; label?: string }) => (z.label ? `${z.name} · ${z.label}` : z.name);
