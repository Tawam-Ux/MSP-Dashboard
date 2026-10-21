import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RestoreIcon from "@mui/icons-material/Restore";
import { Alert, Box } from "@mui/material";
import { useFormContext } from "react-hook-form";
import {
  Button,
  Edit,
  ListButton,
  RadioButtonGroupInput,
  ReferenceInput,
  SaveButton,
  SelectInput,
  SimpleForm,
  TextInput,
  Toolbar,
  TopToolbar,
  required,
  useRecordContext,
} from "react-admin";
import { categoryOption, zoneOption } from "./options";

// แก้หน่วยในหน้า หน่วยงาน Sales Zone / Operations (ทีละหน่วย): ชื่อ · หน่วยงาน · โซน · ประเภท
// บันทึกแล้วระบบแทนผังและคำนวณงบใหม่ทันที · เปลี่ยนประเภทแล้วหน่วยย้ายไปอยู่อีกหน้า
// หน่วยที่กำหนดในโค้ดเก็บเป็นค่าแก้ทับ (ไม่หายตอนนำเข้าไฟล์) และคืนค่าตามโค้ดได้

type Defaults = { name: string; orgCode: string; orgName: string; zoneCode: string; zoneName: string; category: string; categoryName: string };
type LeafUnit = {
  id: string; code: string; name: string; orgCode: string; zoneCode: string; category: string;
  source: "code" | "detected"; defaults: Defaults | null; overridden: boolean;
};

function Title() {
  const record = useRecordContext<LeafUnit>();
  return <span>หน่วย {record?.code}</span>;
}

function Actions() {
  return (
    <TopToolbar sx={{ justifyContent: "flex-start" }}>
      <ListButton label="ย้อนกลับ" icon={<ArrowBackIcon />} />
    </TopToolbar>
  );
}

/** ใส่ค่าตามผังในโค้ดกลับในฟอร์ม (กดบันทึกเพื่อยืนยัน) */
function RestoreButton() {
  const record = useRecordContext<LeafUnit>();
  const { setValue } = useFormContext();
  if (!record?.defaults) return null;
  const d = record.defaults;
  const restore = () => {
    setValue("name", d.name, { shouldDirty: true });
    setValue("orgCode", d.orgCode, { shouldDirty: true });
    setValue("zoneCode", d.zoneCode, { shouldDirty: true });
    setValue("category", d.category, { shouldDirty: true });
  };
  return <Button label="คืนค่าตามผังในโค้ด" onClick={restore}><RestoreIcon /></Button>;
}

function FormToolbar() {
  return (
    <Toolbar sx={{ justifyContent: "space-between" }}>
      <SaveButton label="บันทึกและคำนวณงบใหม่" />
      <RestoreButton />
    </Toolbar>
  );
}

/** บอกว่าหน่วยนี้มาจากไหน และค่าตามโค้ดเป็นอะไร */
function SourceNote() {
  const record = useRecordContext<LeafUnit>();
  if (!record) return null;
  if (!record.defaults) {
    return <Alert severity="info" sx={{ mb: 2 }}>หน่วยใหม่ที่ระบบตรวจพบจากไฟล์ (เลือกประเภทในหน้า หน่วยงานใหม่)</Alert>;
  }
  const d = record.defaults;
  return (
    <Alert severity={record.overridden ? "warning" : "info"} sx={{ mb: 2 }}>
      ค่าตามผังในโค้ด: {d.name} · {d.orgName} · {d.zoneName} · {d.categoryName}
      {record.overridden && " — หน่วยนี้ถูกแก้ทับแล้ว"}
    </Alert>
  );
}

export function LeafUnitEdit() {
  return (
    <Edit title={<Title />} actions={<Actions />} mutationMode="pessimistic" redirect="list" sx={{ maxWidth: 720 }}>
      <SimpleForm toolbar={<FormToolbar />}>
        <Box sx={{ width: "100%" }}>
          <SourceNote />
        </Box>
        <TextInput source="code" label="รหัส" disabled helperText="รหัสจากไฟล์ Master แก้ไม่ได้" />
        <TextInput source="name" label="ชื่อหน่วย" validate={required("ใส่ชื่อหน่วย")} helperText="ชื่อที่แสดงใน Dashboard" />
        <ReferenceInput source="orgCode" reference="organizations" sort={{ field: "order", order: "ASC" }}>
          <SelectInput label="หน่วยงาน" optionText="name" validate={required("เลือกหน่วยงาน")} helperText="เพิ่มหน่วยงานใหม่ได้จากปุ่ม แก้ไข ในหน้ารายการ" />
        </ReferenceInput>
        <ReferenceInput source="zoneCode" reference="zones" sort={{ field: "order", order: "ASC" }}>
          <SelectInput label="โซน" optionText={zoneOption} validate={required("เลือกโซน")} helperText="เพิ่ม/แก้โซนได้ที่หน้า แก้ไขฐานข้อมูล" />
        </ReferenceInput>
        <ReferenceInput source="category" reference="categories" sort={{ field: "order", order: "ASC" }}>
          <RadioButtonGroupInput
            label="ประเภท"
            optionText={categoryOption}
            validate={required("เลือกประเภท")}
            helperText="เปลี่ยนประเภทแล้วหน่วยย้ายไปอยู่อีกหน้า"
            row={false}
          />
        </ReferenceInput>
      </SimpleForm>
    </Edit>
  );
}
