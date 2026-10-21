import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Chip, Typography } from "@mui/material";
import {
  DataTable,
  Edit,
  List,
  ListButton,
  NumberInput,
  SaveButton,
  SimpleForm,
  TextInput,
  Toolbar,
  TopToolbar,
  useRecordContext,
} from "react-admin";
import { ColumnSearchInput, SearchScopeHeader } from "./column-search";
import { fixedTableSx, listToolbarSx, ONLY_WITH_DATA, ShowNoDataToggle } from "./data-toggle";

// หน้า "Branch Area": พื้นที่ ตร.ม. ของสาขาขาย ใช้คิดเกณฑ์ "รายได้จากการขายต่อ ตร.ม." ของหน้า Sales Zone
// เกณฑ์ของโซน = รายได้จากการขาย (Group A) รวม ÷ ตร.ม. รวม ของสาขาที่มี Group A และมี ตร.ม.
// ค่ามาจากชีต Branch_Area ในไฟล์ Master · แก้ที่นี่แล้วเกณฑ์คำนวณใหม่ทันที (ไฟล์ Master ถัดไปที่มีชีตนี้เขียนทับ)

type AreaRecord = {
  id: string;
  code: string;
  name: string;
  zone: string;
  areaSqm: number | null;
  source: "file" | "admin" | null;
  updatedAt: string | null;
  hasSales: boolean;
  hasData: boolean;
  status: "ok" | "missing" | "idle" | "unknown";
  statusLabel: string;
};

const area = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function AreaField() {
  const r = useRecordContext<AreaRecord>();
  if (!r) return null;
  return r.areaSqm == null ? <Typography component="span" color="text.secondary">—</Typography> : <span>{area.format(r.areaSqm)}</span>;
}

function SourceField() {
  const r = useRecordContext<AreaRecord>();
  if (!r?.source) return null;
  return r.source === "admin" ? <Chip size="small" label="แก้ในแอป" color="info" variant="outlined" /> : <span>ไฟล์ Master</span>;
}

function StatusField() {
  const r = useRecordContext<AreaRecord>();
  if (!r) return null;
  const color = r.status === "ok" ? "success" : r.status === "missing" ? "warning" : "default";
  return <Chip size="small" label={r.statusLabel} color={color} variant={r.status === "ok" ? "outlined" : "filled"} />;
}

// คอลัมน์ที่คลิกหัวเพื่อค้นหาเฉพาะคอลัมน์นั้น (ต้องตรงกับ searchFields ใน src/app/api/admin/branch-areas/route.ts)
const SEARCH_COLUMNS = { code: "รหัสสาขา", name: "ชื่อสาขา", zone: "โซน", statusLabel: "สถานะ" } as const;

/** ความกว้างคอลัมน์คงที่: สถานะกว้างพอสำหรับป้ายที่ยาวที่สุด ("มีรายได้แต่ไม่มี ตร.ม.") — สลับสวิตช์แล้วตารางไม่ยืดหด */
const areaTableSx = fixedTableSx({ "col-code": 120, "col-zone": 200, "col-area": 140, "col-source": 140, "col-status": 200 }, 1000);

const filters = [<ColumnSearchInput key="q" source="q" alwaysOn columns={SEARCH_COLUMNS} allPlaceholder="ค้นหารหัส/ชื่อ/โซน/สถานะ" />];

export function BranchAreaList() {
  return (
    <List title="Branch Area" filters={filters} filterDefaultValues={ONLY_WITH_DATA} actions={<TopToolbar><ShowNoDataToggle /></TopToolbar>} perPage={100} sx={listToolbarSx}>
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          พื้นที่ ตร.ม. ใช้คิดเกณฑ์รายได้ต่อ ตร.ม. ของ Sales Zone = รายได้จากการขาย (Group A) รวม ÷ ตร.ม. รวม ของสาขาที่มี Group A ·
          ค่ามาจากชีต Branch_Area ในไฟล์ Master · คลิกแถวเพื่อแก้ — สาขา "มีรายได้แต่ไม่มี ตร.ม." ไม่ถูกนับในเกณฑ์
        </Typography>
      </Box>
      <DataTable rowClick="edit" bulkActionButtons={false} sx={areaTableSx}>
        <DataTable.Col source="code" label={<SearchScopeHeader field="code" label={SEARCH_COLUMNS.code} />} disableSort headerClassName="col-code" />
        <DataTable.Col source="name" label={<SearchScopeHeader field="name" label={SEARCH_COLUMNS.name} />} disableSort />
        <DataTable.Col source="zone" label={<SearchScopeHeader field="zone" label={SEARCH_COLUMNS.zone} />} disableSort headerClassName="col-zone" />
        <DataTable.Col source="areaSqm" label="พื้นที่ (ตร.ม.)" align="right" disableSort headerClassName="col-area">
          <AreaField />
        </DataTable.Col>
        <DataTable.Col source="source" label="ที่มา" disableSort headerClassName="col-source">
          <SourceField />
        </DataTable.Col>
        <DataTable.Col source="statusLabel" label={<SearchScopeHeader field="statusLabel" label={SEARCH_COLUMNS.statusLabel} />} disableSort headerClassName="col-status">
          <StatusField />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}

function EditTitle() {
  const r = useRecordContext<AreaRecord>();
  return <span>พื้นที่สาขา {r?.code}</span>;
}

function EditActions() {
  return (
    <TopToolbar sx={{ justifyContent: "flex-start" }}>
      <ListButton label="ย้อนกลับ" icon={<ArrowBackIcon />} />
    </TopToolbar>
  );
}

export function BranchAreaEdit() {
  return (
    <Edit title={<EditTitle />} actions={<EditActions />} mutationMode="pessimistic" redirect="list" sx={{ maxWidth: 760 }}>
      <SimpleForm toolbar={<Toolbar><SaveButton label="บันทึกและคำนวณเกณฑ์ใหม่" /></Toolbar>}>
        <Alert severity="info" sx={{ mb: 2, width: "100%" }}>
          บันทึกแล้วเกณฑ์รายได้ต่อ ตร.ม. ของทุกเดือนคำนวณใหม่ทันที · นำเข้าไฟล์ Master ที่มีชีต Branch_Area ครั้งถัดไป ค่าในไฟล์จะเขียนทับค่าที่แก้ที่นี่
        </Alert>
        <TextInput source="code" label="รหัสสาขา" disabled />
        <TextInput source="name" label="ชื่อสาขา" disabled fullWidth />
        <TextInput source="zone" label="โซน" disabled />
        <NumberInput source="areaSqm" label="พื้นที่ (ตร.ม.)" min={0} step={1} helperText="ว่าง = ไม่มีข้อมูล (สาขานี้ไม่ถูกนับในเกณฑ์)" />
      </SimpleForm>
    </Edit>
  );
}
