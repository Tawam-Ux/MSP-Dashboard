import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CategoryIcon from "@mui/icons-material/Category";
import FactoryIcon from "@mui/icons-material/Factory";
import PlaceIcon from "@mui/icons-material/Place";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { Box, ListItemIcon, Menu, MenuItem, Typography } from "@mui/material";
import { useState } from "react";
import {
  Button,
  DataTable,
  DateField,
  Edit,
  ExportButton,
  FilterButton,
  List,
  ListButton,
  RadioButtonGroupInput,
  ReferenceInput,
  SaveButton,
  SearchInput,
  SelectInput,
  SimpleForm,
  TextInput,
  Toolbar,
  TopToolbar,
  required,
  useGetList,
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
  useUnselectAll,
} from "react-admin";
import { postJson } from "./api";
import { fixedTableSx, listToolbarSx, ONLY_WITH_DATA, ShowNoDataToggle } from "./data-toggle";

const pendingTableSx = fixedTableSx({ "col-code": 140, "col-sheet": 180, "col-zone": 170, "col-date": 210 }, 960);
import { categoryOption, zoneOption } from "./options";

// หน้า "หน่วยงานใหม่": หน่วยที่ระบบตรวจพบในชีตงบ (ไม่อยู่ในผังที่กำหนดในโค้ด) และยังไม่ได้เลือกว่าเป็น Sales Zone หรือ Operations
// ระหว่างรอ ยอดของหน่วยเก็บไว้แล้วแต่ยังไม่นับใน Dashboard · เลือกแล้วหน่วยย้ายไปหน้า Sales Zone/Operations และงบคำนวณใหม่ทันที

type PendingUnit = { id: string; code: string; name: string; sheet: string; zoneCode: string | null; zoneName: string | null };
type CategoryRow = { id: string; name: string; page: string };

/**
 * ส่งหลายหน่วยในคำขอเดียว (/api/admin/pending-units/bulk) — ระบบแทนผังและคำนวณงบครั้งเดียว
 * (ส่งทีละหน่วยพร้อมกันแบบ updateMany จะชนกันตอนแทนผัง)
 */
function useBulk() {
  const { selectedIds } = useListContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const [pending, setPending] = useState(false);
  const run = async (body: { zoneCode?: string; category?: string }, success: string, after?: () => void) => {
    setPending(true);
    try {
      await postJson("/pending-units/bulk", { ids: selectedIds, ...body });
      notify(success, { type: "success" });
      after?.();
    } catch (e) {
      notify(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ", { type: "error" });
    } finally {
      setPending(false);
      refresh();
    }
  };
  return { selectedIds, pending, run };
}

/** ตั้งประเภทให้หน่วยที่ติ๊กเลือกพร้อมกัน — ใช้โซนของแต่ละหน่วย (หน่วยที่ไม่มีโซนต้องกด เลือกโซน ก่อน) · ประเภทมาจากหน้า แก้ไขฐานข้อมูล */
function CategoryButton() {
  const unselectAll = useUnselectAll("pending-units");
  const { selectedIds, pending, run } = useBulk();
  const { data: categories = [] } = useGetList<CategoryRow>("categories", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "order", order: "ASC" },
  });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const assign = (c: CategoryRow) => {
    setAnchor(null);
    run({ category: c.id }, `ตั้ง ${selectedIds.length} หน่วยเป็น ${c.name} แล้ว — งบคำนวณใหม่เรียบร้อย`, unselectAll);
  };
  return (
    <>
      <Button label="เลือกประเภท" onClick={(e) => setAnchor(e.currentTarget)} disabled={pending}>
        <CategoryIcon />
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {categories.map((c) => (
          <MenuItem key={c.id} onClick={() => assign(c)}>
            <ListItemIcon>{c.page === "sales" ? <StorefrontIcon fontSize="small" /> : <FactoryIcon fontSize="small" />}</ListItemIcon>
            {categoryOption(c)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** ตั้งโซนให้หน่วยที่ติ๊กเลือกพร้อมกัน (หน่วยยังรอเลือกประเภท) — ใช้กับหน่วยที่ระบบเดาโซนจากชีตไม่ได้ */
function ZoneButton() {
  const { selectedIds, pending, run } = useBulk();
  const { data: zones = [] } = useGetList<{ id: string; name: string; label: string }>("zones", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "order", order: "ASC" },
  });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // ไม่ยกเลิกการติ๊ก: ตั้งโซนแล้วกดเลือกประเภทต่อได้ทันที
  const apply = (zone: { id: string; name: string }) => {
    setAnchor(null);
    run({ zoneCode: zone.id }, `ตั้ง ${selectedIds.length} หน่วยเป็น ${zone.name} แล้ว — เลือกประเภทต่อได้เลย`);
  };

  return (
    <>
      <Button label="เลือกโซน" onClick={(e) => setAnchor(e.currentTarget)} disabled={pending}>
        <PlaceIcon />
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {zones.map((z) => (
          <MenuItem key={z.id} onClick={() => apply(z)}>{zoneOption(z)}</MenuItem>
        ))}
      </Menu>
    </>
  );
}

const bulkActions = (
  <>
    <ZoneButton />
    <CategoryButton />
  </>
);

function ZoneField() {
  const record = useRecordContext<PendingUnit>();
  if (!record) return null;
  return record.zoneName ? <span>{record.zoneName}</span> : <span style={{ color: "#b45309" }}>ต้องเลือกโซน</span>;
}

function Empty() {
  return (
    <Box sx={{ textAlign: "center", py: 8, px: 2 }}>
      <Typography variant="h6" gutterBottom>ไม่มีหน่วยงานใหม่ที่รอเลือกประเภท</Typography>
      <Typography variant="body2" color="text.secondary">
        เมื่อนำเข้าไฟล์แล้วพบรหัสหน่วยที่ยังไม่อยู่ในผัง หน่วยนั้นจะมาแสดงที่หน้านี้
      </Typography>
    </Box>
  );
}

const filters = [<SearchInput key="q" source="q" alwaysOn placeholder="ค้นหารหัส/ชื่อหน่วย/ชีต" />];

export function PendingUnitList() {
  return (
    <List title="หน่วยงานใหม่ (รอเลือกประเภท)" filters={filters} filterDefaultValues={ONLY_WITH_DATA} sort={{ field: "code", order: "ASC" }} perPage={50} empty={<Empty />}
      actions={<TopToolbar><FilterButton /><ExportButton /><ShowNoDataToggle /></TopToolbar>} sx={listToolbarSx}>
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          ติ๊กเลือกหน่วยแล้วกด เลือกโซน (ถ้ายังไม่มีโซน) จากนั้นกด เลือกประเภท · หรือคลิกที่แถวเพื่อแก้ทีละหน่วย — ยอดของหน่วยจะนับใน Dashboard หลังเลือกประเภทแล้ว
        </Typography>
      </Box>
      {/* ความกว้างคอลัมน์คงที่ — สลับสวิตช์/ค้นหาแล้วตารางไม่ยืดหด */}
      <DataTable bulkActionButtons={bulkActions} rowClick="edit" sx={pendingTableSx}>
        <DataTable.Col source="code" label="รหัส" headerClassName="col-code" />
        <DataTable.Col source="name" label="ชื่อหน่วย (ในไฟล์)" />
        <DataTable.Col source="sheet" label="พบในชีต" headerClassName="col-sheet" />
        <DataTable.Col source="zoneName" label="โซน" disableSort headerClassName="col-zone">
          <ZoneField />
        </DataTable.Col>
        <DataTable.Col source="detectedAt" label="พบเมื่อ" disableSort headerClassName="col-date">
          <DateField source="detectedAt" locales="th-TH" showTime />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}

function EditTitle() {
  const record = useRecordContext<PendingUnit>();
  return <span>หน่วยงานใหม่ {record?.code}</span>;
}

function EditActions() {
  return (
    <TopToolbar sx={{ justifyContent: "flex-start" }}>
      <ListButton label="ย้อนกลับ" icon={<ArrowBackIcon />} />
    </TopToolbar>
  );
}

export function PendingUnitEdit() {
  return (
    <Edit title={<EditTitle />} actions={<EditActions />} mutationMode="pessimistic" redirect="list" sx={{ maxWidth: 720 }}>
      <SimpleForm toolbar={<Toolbar><SaveButton label="บันทึกและนับในงบ" /></Toolbar>}>
        <TextInput source="code" label="รหัส" disabled helperText="รหัสจากไฟล์ Master" />
        <TextInput source="name" label="ชื่อหน่วย" validate={required("ใส่ชื่อหน่วย")} helperText="ชื่อที่แสดงใน Dashboard" />
        <TextInput source="sheet" label="พบในชีต" disabled />
        <ReferenceInput source="orgCode" reference="organizations" sort={{ field: "order", order: "ASC" }}>
          <SelectInput label="หน่วยงาน" optionText="name" emptyText="MSP Interfood (เริ่มต้น)" helperText="ว่าง = หน่วยงานเริ่มต้น" />
        </ReferenceInput>
        <ReferenceInput source="zoneCode" reference="zones" sort={{ field: "order", order: "ASC" }}>
          <SelectInput label="โซน" optionText={zoneOption} validate={required("เลือกโซน")} helperText="ระบบเดาจากชีตที่พบ ตรวจให้ถูกต้อง" />
        </ReferenceInput>
        <ReferenceInput source="category" reference="categories" sort={{ field: "order", order: "ASC" }}>
          <RadioButtonGroupInput label="ประเภท" optionText={categoryOption} validate={required("เลือกประเภท")} row={false} />
        </ReferenceInput>
      </SimpleForm>
    </Edit>
  );
}
