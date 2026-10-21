import DoneIcon from "@mui/icons-material/Done";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Chip, Typography } from "@mui/material";
import { keyframes } from "@mui/system";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  DataTable,
  ExportButton,
  List,
  TextArrayField,
  TopToolbar,
  useRecordContext,
  useResourceContext,
  useUnselectAll,
} from "react-admin";
import { BulkDeleteButton, BulkEditButton } from "./bulk-edit";
import { ColumnSearchInput, SearchScopeHeader as ColumnHeader } from "./column-search";
import { fixedTableSx, listToolbarSx, ONLY_WITH_DATA, ShowNoDataToggle } from "./data-toggle";
import { PAGE_LABEL } from "./options";

// บทบาทดูได้อย่างเดียว (มาจาก seed) · หน่วยงาน: คลิกแถวเพื่อแก้ชื่อ/โซน/ประเภท (unit-edit.tsx)
// ผังหน่วยกำหนดในโค้ด (src/backend/lib/master-import/units.ts) ค่าที่แก้เก็บเป็นค่าแก้ทับ

export function RoleList() {
  return (
    <List perPage={50} pagination={false} sort={{ field: "id", order: "ASC" }}>
      <DataTable bulkActionButtons={false} rowClick={false}>
        <DataTable.Col source="code" label="รหัส" />
        <DataTable.Col source="name" label="ชื่อบทบาท" />
        <DataTable.Col source="permissions" label="สิทธิ์" disableSort>
          <TextArrayField source="permissions" />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}

// ---------- ค้นหาเฉพาะคอลัมน์: คลิกหัวคอลัมน์เพื่อเลือก (column-search.tsx) ----------

const SEARCH_COLUMNS = { code: "รหัส", name: "ชื่อหน่วย", zoneName: "โซน", zoneLabel: "ชื่อโซน" } as const;
type SearchColumn = keyof typeof SEARCH_COLUMNS;

const unitFilters = [<ColumnSearchInput key="q" source="q" alwaysOn columns={SEARCH_COLUMNS} allPlaceholder="ค้นหารหัส/ชื่อหน่วย/โซน/ชื่อโซน" />];

function SearchScopeHeader({ field }: { field: SearchColumn }) {
  return <ColumnHeader field={field} label={SEARCH_COLUMNS[field]} />;
}

/**
 * ความกว้างคอลัมน์คงที่ (table-layout: fixed) — ตารางไม่ยืดหดตามข้อมูลในหน้าที่ดู ผลค้นหา หรือการติ๊กเลือก
 * ข้อความที่ยาวเกินช่องตัดเป็น … (ดูเต็มได้ที่หน้าแก้ไข)
 */
const unitTableSx = fixedTableSx({
  "col-code": "14%", "col-zone": "12%", "col-zone-label": "13%", "col-org": "16%", "col-type": 136, "col-page": 152,
});

/**
 * ตารางหน่วยงานตามแบบ Preview_React: รหัส · ชื่อหน่วย · โซน · ชื่อโซน · หน่วยงาน · ประเภท · แสดงหน้าที่
 * แยกหน้า Sales Zone (resource sales-units) กับ Operations (resource operation-units) — API ส่งเฉพาะหน่วยล่างสุดของประเภทนั้น
 */
export function SalesUnitList() {
  return <UnitList title="หน่วยงาน Sales Zone" />;
}

export function OperationUnitList() {
  return <UnitList title="หน่วยงาน Operations" />;
}

/**
 * ปุ่ม แก้ไข (ข้าง Export): เปิดโหมดแก้ไข → มีช่องติ๊กเลือกหน่วย แล้วกด "แก้ไขที่เลือก" เพื่อเปลี่ยน โซน · หน่วยงาน · ประเภท พร้อมกัน
 * กดอีกครั้ง (เสร็จสิ้น) = ปิดโหมดแก้ไขและยกเลิกการติ๊ก
 */
function EditModeButton({ editing, onToggle }: { editing: boolean; onToggle: () => void }) {
  return (
    <Button
      label={editing ? "เสร็จสิ้น" : "แก้ไข"}
      onClick={onToggle}
      variant={editing ? "contained" : "text"}
      sx={{ transition: `background-color ${EDIT_MS}ms ${EASE}, color ${EDIT_MS}ms ${EASE}, box-shadow ${EDIT_MS}ms ${EASE}` }}
    >
      {editing ? <DoneIcon /> : <EditIcon />}
    </Button>
  );
}

// แอนิเมชันเปิด/ปิดโหมดแก้ไข: ช่องติ๊กค่อยๆ ปรากฏ/จางหาย (ปิดโหมดแล้วรอแอนิเมชันจบก่อนเอาช่องติ๊กออก) · ข้อความแนะนำเลื่อนลง/ขึ้น
const EDIT_MS = 220;
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
// จางเข้า/ออกอย่างเดียว ไม่ย่อขยาย
const checkIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const checkOut = keyframes`from { opacity: 1; } to { opacity: 0; }`;

/** โหมดแก้ไข: editing = แสดงช่องติ๊ก · closing = กำลังเล่นแอนิเมชันปิด (ช่องติ๊กยังอยู่จนจบ) */
function useEditMode(resource: string) {
  const unselectAll = useUnselectAll(resource);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const toggle = () => {
    if (!editing) return setEditing(true);
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      unselectAll();
      setEditing(false);
      setClosing(false);
    }, EDIT_MS);
  };
  return { editing, closing, toggle };
}

function UnitList({ title }: { title: string }) {
  const resource = useResourceContext() ?? "";
  const { editing, closing, toggle } = useEditMode(resource);
  const checkboxSx = {
    "& .MuiTableCell-paddingCheckbox > *": { animation: editing ? `${closing ? checkOut : checkIn} ${EDIT_MS}ms ${EASE} both` : "none" },
    "@media (prefers-reduced-motion: reduce)": { "& .MuiTableCell-paddingCheckbox > *": { animation: "none" } },
  };
  return (
    // actions กำหนดเอง: ปุ่ม "Add filter" ค่าเริ่มต้นจะโผล่เมื่อมี qField (ตัวกรองที่ไม่มีช่องกรอก) ซึ่งไม่มีอะไรให้เพิ่ม
    <List
      title={title}
      filters={unitFilters}
      filterDefaultValues={ONLY_WITH_DATA}
      actions={
        <TopToolbar sx={{ gap: 1 }}>
          <EditModeButton editing={editing && !closing} onToggle={toggle} />
          <ExportButton />
          <ShowNoDataToggle />
        </TopToolbar>
      }
      perPage={50}
      // เรียงตามรหัส (ตัวอักษรแล้วตัวเลข: CM-101, CM-102 … CM-170, FAC-…) — หน่วยที่เพิ่มจากไฟล์ทีหลังแทรกอยู่ในลำดับเดียวกัน
      sort={{ field: "code", order: "ASC" }}
      sx={listToolbarSx}
    >
      {/* บรรทัดคำแนะนำสูงคงที่ทั้งสองโหมด (สลับข้อความ ไม่พับ/กาง) ตารางจึงไม่ถูกดันขึ้นลง */}
      <Box sx={{ display: "grid", px: 2, pt: 1.5, pb: 0.5, "& > *": { gridArea: "1 / 1" } }}>
        {[
          { on: !(editing && !closing), text: "คลิกที่แถวเพื่อแก้ทีละหน่วย หรือกด แก้ไข เพื่อแก้หลายหน่วยพร้อมกัน" },
          { on: editing && !closing, text: "ติ๊กเลือกหน่วย (หรือคลิกที่แถว) แล้วกด \"แก้ไขที่เลือก\" เพื่อเปลี่ยน โซน · หน่วยงาน · ประเภท พร้อมกัน" },
        ].map((h) => (
          <Typography
            key={h.text}
            variant="body2"
            color="text.secondary"
            noWrap
            aria-hidden={!h.on}
            title={h.text}
            sx={{ opacity: h.on ? 1 : 0, visibility: h.on ? "visible" : "hidden", transition: `opacity ${EDIT_MS}ms ${EASE}, visibility ${EDIT_MS}ms` }}
          >
            {h.text}
          </Typography>
        ))}
      </Box>
      {/* โหมดแก้ไข: มีช่องติ๊ก คลิกแถว = ติ๊ก · ปกติ: คลิกแถว = แก้ทีละหน่วย */}
      <DataTable
        bulkActionButtons={editing ? <><BulkEditButton /><BulkDeleteButton /></> : false}
        rowClick={editing ? "toggleSelection" : "edit"}
        sx={[unitTableSx, checkboxSx]}
      >
        {/* คลิกหัวคอลัมน์ = เลือกคอลัมน์ค้นหา (แทนการเรียง — รายการเรียงตามผังหน่วยอยู่แล้ว) */}
        <DataTable.Col source="code" label={<SearchScopeHeader field="code" />} disableSort headerClassName="col-code" />
        <DataTable.Col source="name" label={<SearchScopeHeader field="name" />} disableSort />
        <DataTable.Col source="zoneName" label={<SearchScopeHeader field="zoneName" />} disableSort headerClassName="col-zone" />
        {/* ความหมายของรหัสโซน (Zone-CMI → โซนเชียงใหม่) กำหนดใน src/backend/lib/master-import/units.ts */}
        <DataTable.Col source="zoneLabel" label={<SearchScopeHeader field="zoneLabel" />} disableSort headerClassName="col-zone-label" />
        <DataTable.Col source="orgName" label="หน่วยงาน" disableSort headerClassName="col-org" />
        <DataTable.Col source="category" label="ประเภท" disableSort headerClassName="col-type">
          <TypeField />
        </DataTable.Col>
        {/* ไม่ให้เรียง: ไอคอนลูกศรเรียงทำให้หัวคอลัมน์เยื้องจากข้อมูลที่จัดกึ่งกลาง */}
        <DataTable.Col source="page" label="แสดงหน้าที่" align="center" disableSort headerClassName="col-page">
          <PageField />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}

type Unit = { id: string; code: string; name: string; category: string | null; categoryName: string | null; page: string | null };

/** ประเภทของหน่วย (กลุ่มที่อยู่ในผัง: Operations (Op) / Sales Zone (Sz)) */
function TypeField() {
  const record = useRecordContext<Unit>();
  if (!record) return null;
  return <span>{record.categoryName ?? "—"}</span>;
}

/** หน้าที่หน่วยนี้แสดงใน Dashboard — ป้ายขนาดเท่ากัน */
function PageField() {
  const record = useRecordContext<Unit>();
  if (!record?.page) return <span style={{ color: "rgba(0,0,0,0.38)" }}>—</span>;
  const color = record.page === "sales" ? ("primary" as const) : ("secondary" as const);
  return <Chip size="small" label={PAGE_LABEL[record.page] ?? record.page} color={color} sx={{ width: 112 }} />;
}
