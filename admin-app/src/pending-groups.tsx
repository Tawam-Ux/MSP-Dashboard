import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CategoryIcon from "@mui/icons-material/Category";
import { Box, Menu, MenuItem, Typography } from "@mui/material";
import { useState } from "react";
import {
  Button,
  DataTable,
  DateField,
  Edit,
  List,
  ListButton,
  NumberField,
  RadioButtonGroupInput,
  SaveButton,
  SearchInput,
  SimpleForm,
  TextInput,
  Toolbar,
  TopToolbar,
  required,
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
  useUnselectAll,
} from "react-admin";
import { postJson } from "./api";

// หน้า "Group ใหม่": รหัส Group ในคอลัมน์ A ของชีตงบที่ไม่อยู่ใน Flow การคำนวณ และยังไม่ได้เลือกหมวด
// ระหว่างรอ ยอดเก็บไว้แล้วแต่ยังไม่นับใน Dashboard · เลือกหมวดแล้ว Group มีแถวท้ายหมวดนั้นในงบ และงบคำนวณใหม่ทันที

type PendingGroup = { id: string; code: string; name: string; fileAmount: number };

/** หมวดที่เลือกได้ — ตรงกับ GROUP_SECTIONS ใน src/backend/lib/master-import/compute.ts */
export const SECTION_CHOICES = [
  { id: "revenue", name: "รายได้" },
  { id: "cogs", name: "ต้นทุนขาย" },
  { id: "other_cost", name: "ต้นทุนขายอื่นๆ" },
  { id: "selling", name: "ค่าใช้จ่ายในการขาย" },
  { id: "admin", name: "ค่าใช้จ่ายในการบริหาร" },
  { id: "finance", name: "รายการใต้กำไรจากการดำเนินงาน (ค่าเสื่อม/ดอกเบี้ย)" },
];

/** เลือกหมวดให้ Group ที่ติ๊กเลือกพร้อมกัน — ส่งคำขอเดียว (/api/admin/pending-groups/bulk) งบคำนวณใหม่ครั้งเดียว */
function SectionButton() {
  const { selectedIds } = useListContext();
  const unselectAll = useUnselectAll("pending-groups");
  const notify = useNotify();
  const refresh = useRefresh();
  const [pending, setPending] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const assign = async (s: { id: string; name: string }) => {
    setAnchor(null);
    setPending(true);
    try {
      await postJson("/pending-groups/bulk", { ids: selectedIds, section: s.id });
      notify(`ตั้ง ${selectedIds.length} Group เป็น ${s.name} แล้ว — งบคำนวณใหม่เรียบร้อย`, { type: "success" });
      unselectAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ", { type: "error" });
    } finally {
      setPending(false);
      refresh();
    }
  };

  return (
    <>
      <Button label="เลือกหมวด" onClick={(e) => setAnchor(e.currentTarget)} disabled={pending}>
        <CategoryIcon />
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {SECTION_CHOICES.map((s) => (
          <MenuItem key={s.id} onClick={() => assign(s)}>{s.name}</MenuItem>
        ))}
      </Menu>
    </>
  );
}

function Empty() {
  return (
    <Box sx={{ textAlign: "center", py: 8, px: 2 }}>
      <Typography variant="h6" gutterBottom>ไม่มี Group ใหม่ที่รอเลือกหมวด</Typography>
      <Typography variant="body2" color="text.secondary">
        เมื่อนำเข้าไฟล์แล้วพบรหัส Group (คอลัมน์ A ของชีตงบ) ที่ยังไม่อยู่ใน Flow การคำนวณ Group นั้นจะมาแสดงที่หน้านี้
      </Typography>
    </Box>
  );
}

const filters = [<SearchInput key="q" source="q" alwaysOn placeholder="ค้นหารหัส/ชื่อรายการ" />];

export function PendingGroupList() {
  return (
    <List title="Group ใหม่ (รอเลือกหมวด)" filters={filters} sort={{ field: "code", order: "ASC" }} perPage={50} empty={<Empty />}>
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          ติ๊กเลือก Group แล้วกด เลือกหมวด · หรือคลิกที่แถวเพื่อแก้ทีละตัว — ยอดของ Group จะนับใน Dashboard หลังเลือกหมวดแล้ว
        </Typography>
      </Box>
      <DataTable bulkActionButtons={<SectionButton />} rowClick="edit">
        <DataTable.Col source="code" label="รหัส Group" />
        <DataTable.Col source="name" label="รายการ (ในไฟล์)" />
        <DataTable.Col source="fileAmount" label="ยอดรวมในไฟล์ล่าสุด (บาท)" align="right">
          <NumberField source="fileAmount" locales="th-TH" options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
        </DataTable.Col>
        <DataTable.Col source="detectedAt" label="พบเมื่อ" disableSort>
          <DateField source="detectedAt" locales="th-TH" showTime />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}

function EditTitle() {
  const record = useRecordContext<PendingGroup>();
  return <span>Group ใหม่ {record?.code}</span>;
}

function EditActions() {
  return (
    <TopToolbar sx={{ justifyContent: "flex-start" }}>
      <ListButton label="ย้อนกลับ" icon={<ArrowBackIcon />} />
    </TopToolbar>
  );
}

export function PendingGroupEdit() {
  return (
    <Edit title={<EditTitle />} actions={<EditActions />} mutationMode="pessimistic" redirect="list" sx={{ maxWidth: 720 }}>
      <SimpleForm toolbar={<Toolbar><SaveButton label="บันทึกและนับในงบ" /></Toolbar>}>
        <TextInput source="code" label="รหัส Group" disabled helperText="รหัสในคอลัมน์ A ของไฟล์ Master" />
        <TextInput source="name" label="ชื่อรายการ" validate={required("ใส่ชื่อรายการ")} helperText="ชื่อแถวที่แสดงในงบ" />
        <RadioButtonGroupInput
          source="section"
          label="หมวด"
          choices={SECTION_CHOICES}
          validate={required("เลือกหมวด")}
          row={false}
          helperText="ยอดของ Group จะบวกเข้ายอดรวมของหมวดนี้ (แถวใหม่อยู่ท้ายหมวด)"
        />
      </SimpleForm>
    </Edit>
  );
}
