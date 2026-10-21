import { FormControlLabel, Switch } from "@mui/material";
import { useListContext } from "react-admin";

// ผังของแต่ละปีคัดลอกมาจากปีอื่น จึงมีหน่วยที่ไม่มีข้อมูลในปีที่เลือก (เช่น สาขาที่เปิดปีหลัง)
// รายการซ่อนไว้เป็นค่าเริ่มต้น (API กรองด้วยคีย์ hasData ใน listResponse) · สวิตช์นี้เปิดให้เห็นทั้งหมดเพื่อแก้ไขล่วงหน้า

/**
 * แถบเครื่องมือมาตรฐานของรายการ (ใส่ที่ sx ของ List): ช่องค้นหา (ซ้าย) และปุ่ม/สวิตช์ (ขวา) อยู่กึ่งกลางแนวเดียวกัน
 * ขอบขวาของชิ้นสุดท้ายตรงกับขอบขวาของตาราง — ทุกหน้าใช้ชุดนี้ สวิตช์จึงอยู่ตำแหน่งเดียวกัน
 * FilterForm มีแค่ชื่อคลาสแบบ emotion (css-xxx-RaFilterForm-root) จึงต้องจับด้วย [class*=]
 */
export const listToolbarSx = {
  "& .RaList-actions": { alignItems: "center", minHeight: 64 },
  "& [class*='RaFilterForm-root'], & .RaFilterForm-filterFormInput": { alignItems: "center", minHeight: "auto", pb: 0 },
  "& [class*='RaFilterForm-root'] .MuiFormControl-root": { my: 0 },
  "& .RaList-actions .MuiToolbar-root": { minHeight: "auto", py: 0, pr: 0, alignItems: "center" },
} as const;

/**
 * ตารางความกว้างคอลัมน์คงที่ (table-layout: fixed) — เปิด/ปิดสวิตช์ ค้นหา หรือเปลี่ยนหน้าแล้วคอลัมน์ไม่ย่อ/ขยายตามข้อมูลที่แสดง
 * widths = ชื่อคลาสของหัวคอลัมน์ (headerClassName ของ DataTable.Col) → ความกว้าง · คอลัมน์ที่ไม่ระบุแบ่งพื้นที่ที่เหลือ
 * minWidth = ความกว้างขั้นต่ำของตาราง: จอแคบกว่านี้ตารางเลื่อนแนวนอนแทนการบีบคอลัมน์จนข้อความถูกตัด
 * ข้อความยาวเกินช่องตัดเป็น … · ทุกแถวสูงเท่ากัน (มีป้าย/ไม่มีป้าย)
 */
export function fixedTableSx(widths: Record<string, string | number>, minWidth?: number) {
  return {
    // Freeze หัวตารางตั้งไว้ที่ธีม (RaDataTable ใน layout.tsx) ใช้กับทุกหน้า
    "& .MuiTable-root": { tableLayout: "fixed", width: "100%", minWidth },
    // ตัดข้อความยาวเฉพาะช่องข้อมูล — ช่องติ๊กต้องไม่ถูกตัด ไม่งั้นกรอบ checkbox ขาดเป็นรูป [
    "& .MuiTableCell-root:not(.MuiTableCell-paddingCheckbox)": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    // MUI ตั้ง width 24px ด้วย selector ที่ specificity เท่ากันและมาทีหลัง จึงต้อง !important (48 + padding 8×2 = 64px)
    "& .MuiTableCell-paddingCheckbox": { width: "48px !important", px: "8px !important", textAlign: "center", overflow: "visible" },
    "& .MuiTableBody-root .MuiTableCell-root": { height: 44, py: 0 },
    ...Object.fromEntries(Object.entries(widths).map(([cls, width]) => [`& .${cls}`, { width }])),
  } as const;
}

/** ใช้เป็น filterDefaultValues ของ List */
export const ONLY_WITH_DATA = { hasData: true };

/** แสดงทั้งหมด = ส่ง hasData เป็น [true, false] (ไม่ลบคีย์ทิ้ง ไม่งั้น react-admin ใส่ค่าเริ่มต้นกลับเมื่อตัวกรองว่าง) */
const SHOW_ALL = [true, false];

/**
 * ตำแหน่งมาตรฐาน: ชิ้นสุดท้าย (ขวาสุด) ของแถบเครื่องมือของรายการ — แถวเดียวกับช่องค้นหา ทุกหน้าใช้ข้อความเดียวกัน
 * จึงอยู่ที่เดิมเสมอ ไม่ขยับตามความยาวคำอธิบายหรือจำนวนแถว
 */
export function ShowNoDataToggle() {
  const { filterValues, displayedFilters, setFilters } = useListContext();
  const showAll = filterValues.hasData !== true;
  return (
    <FormControlLabel
      label="แสดงรายการที่ไม่มีข้อมูลในปีนี้"
      sx={{ ml: 1, mr: 0, whiteSpace: "nowrap", "& .MuiFormControlLabel-label": { fontSize: 14, color: "text.secondary" } }}
      control={
        <Switch
          size="small"
          checked={showAll}
          onChange={(e) => setFilters({ ...filterValues, hasData: e.target.checked ? SHOW_ALL : true }, displayedFilters)}
        />
      }
    />
  );
}
