import {
  AutocompleteArrayInput,
  BooleanField,
  BooleanInput,
  ChipField,
  Create,
  DataTable,
  DateField,
  Edit,
  List,
  PasswordInput,
  ReferenceArrayField,
  ReferenceArrayInput,
  SearchInput,
  SimpleForm,
  SingleFieldList,
  TextInput,
  minLength,
  regex,
  required,
  useRecordContext,
} from "react-admin";

// ข้อมูลจาก /api/admin/users ของเว็บหลัก: { id, username, name, authProvider, isActive, createdAt, roleIds, unitCodes }

const userFilters = [<SearchInput key="q" source="q" alwaysOn placeholder="ค้นหาชื่อ/ชื่อผู้ใช้" />];

export function UserList() {
  return (
    <List filters={userFilters} sort={{ field: "username", order: "ASC" }} perPage={25}>
      <DataTable bulkActionButtons={false}>
        <DataTable.Col source="username" label="ชื่อผู้ใช้" />
        <DataTable.Col source="name" label="ชื่อที่แสดง" />
        <DataTable.Col source="roleIds" label="บทบาท" disableSort>
          <ReferenceArrayField source="roleIds" reference="roles">
            <SingleFieldList linkType={false}>
              <ChipField source="name" size="small" />
            </SingleFieldList>
          </ReferenceArrayField>
        </DataTable.Col>
        <DataTable.Col source="unitCodes" label="เห็นข้อมูลของ" disableSort>
          <ReferenceArrayField source="unitCodes" reference="units">
            <SingleFieldList linkType={false}>
              <ChipField source="name" size="small" variant="outlined" />
            </SingleFieldList>
          </ReferenceArrayField>
        </DataTable.Col>
        <DataTable.Col source="isActive" label="ใช้งาน">
          <BooleanField source="isActive" />
        </DataTable.Col>
        <DataTable.Col source="createdAt" label="สร้างเมื่อ">
          <DateField source="createdAt" locales="th-TH" />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}

const usernameRule =regex(/^[\p{L}\p{M}\p{N}._@-]{3,64}$/u, "3-64 ตัว ใช้ตัวอักษร ตัวเลข และ . _ - @ ห้ามมีช่องว่าง");

function AccessInputs() {
  return (
    <>
      <ReferenceArrayInput source="roleIds" reference="roles" perPage={100} sort={{ field: "id", order: "ASC" }}>
        <AutocompleteArrayInput label="บทบาท" optionText="name" validate={required("เลือกบทบาทอย่างน้อย 1 บทบาท")} />
      </ReferenceArrayInput>
      <ReferenceArrayInput source="unitCodes" reference="units" perPage={1000} sort={{ field: "treeIndex", order: "ASC" }}>
        <AutocompleteArrayInput
          label="หน่วยที่ให้เห็น (เห็นสาขาย่อยทั้งหมดของหน่วยที่เลือก)"
          optionText={(u: { code: string; name: string; level: number }) => `${" ".repeat(u.level)}${u.name} (${u.code})`}
          inputText={(u: { code: string; name: string }) => u.name}
          validate={required("เลือกหน่วยอย่างน้อย 1 หน่วย")}
        />
      </ReferenceArrayInput>
    </>
  );
}

export function UserCreate() {
  return (
    <Create redirect="list">
      <SimpleForm>
        <TextInput source="username" label="ชื่อผู้ใช้" validate={[required(), usernameRule]} autoComplete="off" />
        <TextInput source="name" label="ชื่อที่แสดง" validate={required()} />
        <PasswordInput source="password" label="รหัสผ่านเริ่มต้น" validate={[required(), minLength(8, "อย่างน้อย 8 ตัว")]} autoComplete="new-password" />
        <AccessInputs />
      </SimpleForm>
    </Create>
  );
}

function UserTitle() {
  const record = useRecordContext<{ id: number; name: string }>();
  return <span>ผู้ใช้ {record?.name}</span>;
}

export function UserEdit() {
  return (
    <Edit title={<UserTitle />} mutationMode="pessimistic" redirect="list">
      <SimpleForm>
        <TextInput source="username" label="ชื่อผู้ใช้" disabled />
        <TextInput source="name" label="ชื่อที่แสดง" validate={required()} />
        <PasswordInput
          source="password"
          label="รหัสผ่านใหม่"
          helperText="เว้นว่างถ้าไม่ต้องการเปลี่ยน"
          validate={minLength(8, "อย่างน้อย 8 ตัว")}
          autoComplete="new-password"
        />
        <BooleanInput source="isActive" label="เปิดใช้งาน" />
        <AccessInputs />
      </SimpleForm>
    </Edit>
  );
}
