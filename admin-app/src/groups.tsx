import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Chip, Typography } from "@mui/material";
import {
  Button,
  DataTable,
  Edit,
  List,
  ListButton,
  RadioButtonGroupInput,
  SaveButton,
  SimpleForm,
  TextInput,
  Toolbar,
  TopToolbar,
  required,
  useRecordContext,
} from "react-admin";
import { Link, useSearchParams } from "react-router-dom";
import { ColumnSearchInput, SearchScopeHeader } from "./column-search";
import { SECTION_CHOICES } from "./pending-groups";

// หน้า "Group": ทุกรหัส Group (คอลัมน์ A ของชีตงบ) ว่าคือรายการอะไร อยู่หมวดไหน และนับเข้ายอดรวมตัวไหนในงบ
// แก้ย้อนหลังได้: Group ใน Flow ของไฟล์แก้ได้เฉพาะชื่อ (หมวดตายตัวตามสูตร Excel) · Group ใหม่แก้ชื่อและหมวดได้
// บันทึกแล้วงบทุกงวดคำนวณใหม่จากยอดที่เก็บไว้ ไม่ต้องนำเข้าไฟล์ซ้ำ

type GroupRecord = {
  id: string;
  code: string;
  name: string;
  defaultName: string;
  source: "flow" | "new";
  section: string | null;
  sectionLabel: string;
  effect: string;
  status: "counted" | "pending";
  order: number;
};

const PENDING_CHOICE = { id: "pending", name: "ยังไม่นับในงบ (รอเลือกหมวด)" };

function SectionField() {
  const r = useRecordContext<GroupRecord>();
  if (!r) return null;
  return r.status === "pending" ? <Chip size="small" label="รอเลือกหมวด" color="warning" /> : <span>{r.sectionLabel}</span>;
}

function NameField() {
  const r = useRecordContext<GroupRecord>();
  if (!r) return null;
  return (
    <span>
      {r.name}
      {r.source === "flow" && r.name !== r.defaultName && (
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>(เดิม: {r.defaultName})</Typography>
      )}
    </span>
  );
}

// คอลัมน์ที่คลิกหัวเพื่อค้นหาเฉพาะคอลัมน์นั้น (ต้องตรงกับ searchFields ใน src/app/api/admin/groups/route.ts)
const SEARCH_COLUMNS = { code: "รหัส", name: "รายการ (ชื่อในงบ)", sectionLabel: "หมวด", effect: "ผลต่อยอดรวม" } as const;

const filters = [<ColumnSearchInput key="q" source="q" alwaysOn columns={SEARCH_COLUMNS} allPlaceholder="ค้นหารหัส/ชื่อ/หมวด/ผลต่อยอดรวม" />];

/** แก้จากแท็บ Group ในหน้า แก้ไขฐานข้อมูล: ?from=database → ย้อนกลับ/บันทึกแล้วกลับไปแท็บนั้น */
const FROM_DATABASE = "database";
const DATABASE_TAB = "/database?tab=groups";

export function GroupList() {
  return (
    // actions={false}: ปุ่ม "Add filter" ค่าเริ่มต้นจะโผล่เมื่อมี qField (ตัวกรองที่ไม่มีช่องกรอก)
    <List title="Group" filters={filters} actions={false} sort={{ field: "order", order: "ASC" }} perPage={100}>
      <GroupTable rowClick="edit" />
    </List>
  );
}

/** แท็บ Group ในหน้า แก้ไขฐานข้อมูล (master-data.tsx): ไม่ผูกตัวกรอง/หน้ากับ URL (URL ใช้เก็บแท็บ) */
export function GroupDatabaseList() {
  return (
    <List
      resource="groups"
      disableSyncWithLocation
      title=" "
      filters={filters}
      actions={false}
      sort={{ field: "order", order: "ASC" }}
      perPage={100}
      sx={{ "& .RaList-main": { mt: 0 } }}
    >
      <GroupTable rowClick={(id) => `/groups/${encodeURIComponent(String(id))}?from=${FROM_DATABASE}`} />
    </List>
  );
}

function GroupTable({ rowClick }: { rowClick: "edit" | ((id: string | number) => string) }) {
  return (
    <>
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          Group = รหัสในคอลัมน์ A ของชีตงบในไฟล์ Master · เรียงตามลำดับแถวในงบ · คลิกหัวคอลัมน์เพื่อค้นหาเฉพาะคอลัมน์นั้น · คลิกแถวเพื่อแก้ไข — บันทึกแล้วงบทุกเดือนคำนวณใหม่ทันที
        </Typography>
      </Box>
      {/* คลิกหัวคอลัมน์ = เลือกคอลัมน์ค้นหา (แทนการเรียง — รายการเรียงตามลำดับแถวในงบอยู่แล้ว) */}
      <DataTable rowClick={rowClick} bulkActionButtons={false}>
        <DataTable.Col source="code" label={<SearchScopeHeader field="code" label={SEARCH_COLUMNS.code} />} disableSort />
        <DataTable.Col source="name" label={<SearchScopeHeader field="name" label={SEARCH_COLUMNS.name} />} disableSort>
          <NameField />
        </DataTable.Col>
        <DataTable.Col source="sectionLabel" label={<SearchScopeHeader field="sectionLabel" label={SEARCH_COLUMNS.sectionLabel} />} disableSort>
          <SectionField />
        </DataTable.Col>
        <DataTable.Col source="effect" label={<SearchScopeHeader field="effect" label={SEARCH_COLUMNS.effect} />} disableSort />
      </DataTable>
    </>
  );
}

function EditTitle() {
  const r = useRecordContext<GroupRecord>();
  return <span>Group {r?.code}</span>;
}

function EditActions({ fromDatabase }: { fromDatabase: boolean }) {
  return (
    <TopToolbar sx={{ justifyContent: "flex-start" }}>
      {fromDatabase ? (
        <Button label="ย้อนกลับ" component={Link} to={DATABASE_TAB}><ArrowBackIcon /></Button>
      ) : (
        <ListButton label="ย้อนกลับ" icon={<ArrowBackIcon />} />
      )}
    </TopToolbar>
  );
}

function GroupForm() {
  const r = useRecordContext<GroupRecord>();
  if (!r) return null;
  const inFlow = r.source === "flow";
  return (
    <SimpleForm toolbar={<Toolbar><SaveButton label="บันทึกและคำนวณงบใหม่" /></Toolbar>}>
      <Alert severity="info" sx={{ mb: 2, width: "100%" }}>
        {inFlow
          ? "Group นี้อยู่ใน Flow ของไฟล์ Excel — หมวดและสูตรตายตัวตามไฟล์ แก้ได้เฉพาะชื่อที่แสดงในงบ"
          : "Group ใหม่ที่ระบบตรวจพบ — แก้ชื่อและหมวดได้ ยอดจะย้ายไปนับในหมวดใหม่ทุกเดือนทันที"}
      </Alert>
      <TextInput source="code" label="รหัส Group" disabled />
      <TextInput
        source="name"
        label="ชื่อรายการ"
        validate={inFlow ? undefined : required("ใส่ชื่อรายการ")}
        helperText={inFlow ? `ว่าง = ใช้ชื่อตามไฟล์ (${r.defaultName})` : "ชื่อแถวที่แสดงในงบ"}
      />
      <TextInput source="effect" label="ผลต่อยอดรวม (ตอนนี้)" disabled fullWidth />
      {inFlow ? (
        <TextInput source="sectionLabel" label="หมวด" disabled helperText="ตายตัวตาม Flow ของไฟล์" />
      ) : (
        <RadioButtonGroupInput
          source="section"
          label="หมวด"
          choices={[...SECTION_CHOICES, PENDING_CHOICE]}
          validate={required("เลือกหมวด")}
          row={false}
          helperText="ยอดของ Group บวกเข้ายอดรวมของหมวด (แถวอยู่ท้ายหมวด) · รายการใต้กำไรจากการดำเนินงาน = หักจาก OP"
        />
      )}
    </SimpleForm>
  );
}

export function GroupEdit() {
  const [params] = useSearchParams();
  const fromDatabase = params.get("from") === FROM_DATABASE;
  return (
    <Edit
      title={<EditTitle />}
      actions={<EditActions fromDatabase={fromDatabase} />}
      mutationMode="pessimistic"
      redirect={fromDatabase ? () => DATABASE_TAB : "list"}
      sx={{ maxWidth: 760 }}
    >
      <GroupForm />
    </Edit>
  );
}
