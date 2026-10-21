import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Chip, Tab, Tabs, Typography } from "@mui/material";
import type { ReactNode } from "react";
import {
  Button,
  Create,
  CreateButton,
  DataTable,
  DeleteButton,
  Edit,
  List,
  SaveButton,
  SimpleForm,
  TextInput,
  Toolbar,
  TopToolbar,
  required,
  useRecordContext,
} from "react-admin";
import { Link, useSearchParams } from "react-router-dom";
import { fixedTableSx, listToolbarSx, ONLY_WITH_DATA, ShowNoDataToggle } from "./data-toggle";
import { GroupDatabaseList } from "./groups";

// หน้า "แก้ไขฐานข้อมูล": ข้อมูลหลักที่ใช้สร้างผังหน่วย — โซน · หน่วยงาน · Group
// แต่ละแท็บเป็นรายการของ resource (zones / organizations / groups) · คลิกแถว = แก้ · ปุ่ม เพิ่ม = สร้างใหม่ (Group ไม่มี — มาจากไฟล์ Master)
// บันทึก/ลบแล้วระบบแทนผังและคำนวณงบใหม่ทันที · ลบได้เฉพาะรายการที่ไม่มีหน่วยอยู่แล้ว (ระบบตอบข้อความบอกถ้ายังมี)
// ประเภทหน่วย (Sales Zone / Operations) ไม่แก้ในหน้านี้ — เปลี่ยนประเภทของแต่ละหน่วยที่หน้า Sales Zone / Operations

const TABS = [
  { id: "zones", label: "โซน" },
  { id: "organizations", label: "หน่วยงาน" },
  { id: "groups", label: "Group" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** กลับไปหน้า แก้ไขฐานข้อมูล ที่แท็บเดิม (ใช้ทั้งปุ่มย้อนกลับและ redirect หลังบันทึก) */
const backTo = (tab: TabId) => `/database?tab=${tab}`;

export function DatabasePage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as TabId) : "zones";
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 0.5 }}>แก้ไขฐานข้อมูล</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        โซนและหน่วยงานที่ใช้จัดหน่วยในผัง · Group ของรายการในงบ — แก้แล้วระบบจัดผังและคำนวณงบใหม่ทันที
      </Typography>
      <Tabs value={tab} onChange={(_, v: TabId) => setParams({ tab: v }, { replace: true })} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        {TABS.map((t) => <Tab key={t.id} value={t.id} label={t.label} />)}
      </Tabs>
      {tab === "zones" && <ZoneList />}
      {tab === "organizations" && <OrganizationList />}
      {tab === "groups" && <GroupDatabaseList />}
    </Box>
  );
}

/** ความกว้างคอลัมน์คงที่ของตารางในแท็บ (โซน · หน่วยงาน) — สลับสวิตช์แล้วตารางไม่ยืดหด · จำนวนหน่วยกว้างพอสำหรับ "N หน่วย · มีข้อมูลปีนี้ M" */
const tabTableSx = fixedTableSx({ "col-code": 150, "col-name": 190, "col-sheet": 150, "col-count": 260, "col-action": 140 }, 1050);

/** รายการในแท็บ: ไม่ผูกตัวกรอง/หน้ากับ URL (URL ใช้เก็บแท็บ) · แสดงครบในหน้าเดียว */
function TabList({ resource, hint, children }: { resource: TabId; hint: string; children: ReactNode }) {
  return (
    <List
      resource={resource}
      disableSyncWithLocation
      title=" "
      perPage={200}
      pagination={false}
      sort={{ field: "order", order: "ASC" }}
      filterDefaultValues={ONLY_WITH_DATA}
      actions={<TopToolbar><CreateButton label="เพิ่ม" /><ShowNoDataToggle /></TopToolbar>}
      sx={{ ...listToolbarSx, "& .RaList-main": { mt: 0 } }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{hint}</Typography>
      </Box>
      {children}
    </List>
  );
}

/** จำนวนหน่วยในผัง · ถ้าบางหน่วยไม่มีข้อมูลในปีนี้ บอกจำนวนที่มีข้อมูลด้วย (ลบได้เมื่อไม่มีหน่วยในผังเลย) */
function UnitCount() {
  const record = useRecordContext<{ unitCount: number; dataUnitCount: number }>();
  if (!record) return null;
  return (
    <span style={{ color: record.unitCount ? undefined : "rgba(0,0,0,0.45)" }}>
      {record.unitCount} หน่วย
      {record.dataUnitCount < record.unitCount && (
        <span style={{ color: "rgba(0,0,0,0.55)" }}> · มีข้อมูลปีนี้ {record.dataUnitCount}</span>
      )}
    </span>
  );
}

/** ปุ่มลบในแถว — ซ่อนเมื่อรายการลบไม่ได้ (ค่าเริ่มต้น) · ยืนยันก่อนลบ · ข้อความผิดพลาดจากระบบแสดงเป็นแถบแจ้งเตือน */
function RowDelete({ locked, what }: { locked?: (r: Record<string, unknown>) => boolean; what: string }) {
  const record = useRecordContext();
  if (!record || locked?.(record)) return null;
  return (
    <DeleteButton
      mutationMode="pessimistic"
      redirect={false}
      confirmTitle={`ลบ${what} "${String(record.name)}"?`}
      confirmContent={`ลบได้เฉพาะ${what}ที่ไม่มีหน่วยอยู่แล้ว — ระบบจะจัดผังและคำนวณงบใหม่`}
    />
  );
}

function Builtin({ show, label }: { show: boolean; label: string }) {
  return show ? <Chip size="small" label={label} sx={{ ml: 1 }} /> : null;
}

// ---------- โซน ----------

type ZoneRecord = { id: string; code: string; key: string; name: string; label: string; sheetPrefix: string | null; unitCount: number };

function ZoneList() {
  return (
    <TabList resource="zones" hint="แก้รหัสแล้วรหัสในผัง (เช่น Zone-CMI, Sz-CMI) และสิทธิ์ผู้ใช้ที่ผูกไว้เปลี่ยนตาม · ชื่อชีต = ชื่อชีตงบภูมิภาคในไฟล์ Master (เช่น เชียงใหม่_ม.ค.) ใช้เดาโซนของหน่วยใหม่">
      <DataTable rowClick="edit" bulkActionButtons={false} sx={tabTableSx}>
        <DataTable.Col source="code" label="รหัส" disableSort headerClassName="col-code" />
        <DataTable.Col source="name" label="ชื่อในผัง" disableSort headerClassName="col-name" />
        <DataTable.Col source="label" label="ชื่อโซน (ภาษาไทย)" disableSort />
        <DataTable.Col source="sheetPrefix" label="ชื่อชีต" disableSort headerClassName="col-sheet" />
        <DataTable.Col source="unitCount" label="หน่วยในโซน" disableSort headerClassName="col-count"><UnitCount /></DataTable.Col>
        <DataTable.Col label=" " align="right" disableSort headerClassName="col-action"><RowDelete what="โซน" /></DataTable.Col>
      </DataTable>
    </TabList>
  );
}

function ZoneTitle() {
  const record = useRecordContext<ZoneRecord>();
  return <span>โซน {record?.code ?? "ใหม่"}</span>;
}

/** รหัสโซน: ส่วนหลัง Zone- ใช้เป็นรหัสกลุ่มในผัง (Zone-PYO → Sz-PYO, Op-PYO) */
const zoneCodeHelp = "เช่น Zone-PYO — ส่วนหลัง Zone- ใช้เป็นรหัสกลุ่มในผัง (Sz-PYO, Op-PYO)";

const zoneFields = (
  <>
    <TextInput source="label" label="ชื่อโซน (ภาษาไทย)" validate={required("ใส่ชื่อโซนภาษาไทย")} helperText="เช่น โซนเชียงใหม่ — แสดงในคอลัมน์ ชื่อโซน" />
    <TextInput source="sheetPrefix" label="ชื่อชีตงบในไฟล์ Master" helperText="ส่วนก่อน _เดือน เช่น ชีต พะเยา_ม.ค. → พะเยา · เว้นว่างถ้าโซนนี้ไม่มีชีตของตัวเอง" />
  </>
);

export function ZoneCreate() {
  return (
    <Create title={<ZoneTitle />} actions={<Back tab="zones" />} redirect={() => backTo("zones")} sx={{ maxWidth: 720 }}>
      <SimpleForm toolbar={<SaveToolbar label="เพิ่มโซน" />} defaultValues={{ code: "Zone-" }}>
        <TextInput source="code" label="รหัส" validate={required("ใส่รหัส")} helperText={zoneCodeHelp} />
        <TextInput source="name" label="ชื่อในผัง" helperText="ว่าง = ใช้รหัส (เช่น Zone-PYO) · แสดงเป็นชื่อโซนใน Dashboard" />
        {zoneFields}
      </SimpleForm>
    </Create>
  );
}

export function ZoneEdit() {
  return (
    <Edit title={<ZoneTitle />} actions={<Back tab="zones" />} mutationMode="pessimistic" redirect={() => backTo("zones")} sx={{ maxWidth: 720 }}>
      <SimpleForm toolbar={<SaveToolbar label="บันทึกและจัดผังใหม่" />}>
        <TextInput source="code" label="รหัส" validate={required("ใส่รหัส")} helperText={`${zoneCodeHelp} · แก้แล้วสิทธิ์ผู้ใช้และค่าที่อ้างโซนนี้เปลี่ยนตาม`} />
        <TextInput source="name" label="ชื่อในผัง" validate={required("ใส่ชื่อโซน")} helperText="แสดงเป็นชื่อโซนใน Dashboard (ชื่อกลุ่ม เช่น Sales Zone (Sz) Zone-CMI)" />
        {zoneFields}
      </SimpleForm>
    </Edit>
  );
}

// ---------- หน่วยงาน ----------

type OrgRecord = { id: string; code: string; name: string; isDefault: boolean; unitCount: number };

function OrgName() {
  const record = useRecordContext<OrgRecord>();
  if (!record) return null;
  return <span>{record.name}<Builtin show={record.isDefault} label="เริ่มต้น" /></span>;
}

function OrganizationList() {
  return (
    <TabList resource="organizations" hint="หน่วยงาน (บริษัท) ที่อยู่ใต้ MSP รวมทุกหน่วยงาน · หน่วยงานเริ่มต้นแก้ได้เฉพาะชื่อ (รหัสและการลบล็อกไว้)">
      <DataTable rowClick="edit" bulkActionButtons={false} sx={tabTableSx}>
        <DataTable.Col source="code" label="รหัส" disableSort headerClassName="col-code" />
        <DataTable.Col source="name" label="ชื่อหน่วยงาน" disableSort><OrgName /></DataTable.Col>
        <DataTable.Col source="unitCount" label="หน่วยในหน่วยงาน" disableSort headerClassName="col-count"><UnitCount /></DataTable.Col>
        <DataTable.Col label=" " align="right" disableSort headerClassName="col-action"><RowDelete what="หน่วยงาน" locked={(r) => !!r.isDefault} /></DataTable.Col>
      </DataTable>
    </TabList>
  );
}

function OrgTitle() {
  const record = useRecordContext<OrgRecord>();
  return <span>หน่วยงาน {record?.name ?? "ใหม่"}</span>;
}

export function OrganizationCreate() {
  return (
    <Create title={<OrgTitle />} actions={<Back tab="organizations" />} redirect={() => backTo("organizations")} sx={{ maxWidth: 720 }}>
      <SimpleForm toolbar={<SaveToolbar label="เพิ่มหน่วยงาน" />}>
        <TextInput source="code" label="รหัส" helperText="ว่าง = ระบบตั้งให้ (O2, O3, …) · A-Z, 0-9, - หรือ _ ยาวไม่เกิน 10 ตัว" />
        <TextInput source="name" label="ชื่อหน่วยงาน" validate={required("ใส่ชื่อหน่วยงาน")} helperText="ย้ายหน่วยเข้าหน่วยงานได้ที่หน้า Sales Zone / Operations" />
      </SimpleForm>
    </Create>
  );
}

/** รหัสหน่วยงานเริ่มต้นแก้ไม่ได้ (ระบบใช้แยกผังหลักกับหน่วยงานอื่น) */
function OrgCodeInput() {
  const record = useRecordContext<OrgRecord>();
  const locked = !!record?.isDefault;
  return (
    <TextInput
      source="code"
      label="รหัส"
      validate={required("ใส่รหัส")}
      disabled={locked}
      helperText={locked ? "รหัสหน่วยงานเริ่มต้นแก้ไม่ได้ (แก้ชื่อได้)" : "แก้แล้วรหัสในผัง (ORG-…) และสิทธิ์ผู้ใช้ที่ผูกไว้เปลี่ยนตาม"}
    />
  );
}

export function OrganizationEdit() {
  return (
    <Edit title={<OrgTitle />} actions={<Back tab="organizations" />} mutationMode="pessimistic" redirect={() => backTo("organizations")} sx={{ maxWidth: 720 }}>
      <SimpleForm toolbar={<SaveToolbar label="บันทึกและจัดผังใหม่" />}>
        <OrgCodeInput />
        <TextInput source="name" label="ชื่อหน่วยงาน" validate={required("ใส่ชื่อหน่วยงาน")} />
      </SimpleForm>
    </Edit>
  );
}

// ---------- ส่วนร่วม ----------

function Back({ tab }: { tab: TabId }) {
  return (
    <TopToolbar sx={{ justifyContent: "flex-start" }}>
      <Button label="ย้อนกลับ" component={Link} to={backTo(tab)}><ArrowBackIcon /></Button>
    </TopToolbar>
  );
}

function SaveToolbar({ label }: { label: string }) {
  return <Toolbar><SaveButton label={label} /></Toolbar>;
}
