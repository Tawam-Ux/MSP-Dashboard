import BadgeIcon from "@mui/icons-material/Badge";
import FactoryIcon from "@mui/icons-material/Factory";
import SquareFootIcon from "@mui/icons-material/SquareFoot";
import ListAltIcon from "@mui/icons-material/ListAlt";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import PeopleIcon from "@mui/icons-material/People";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import StorefrontIcon from "@mui/icons-material/Storefront";
import simpleRestProvider from "ra-data-simple-rest";
import { Admin, CustomRoutes, Resource, fetchUtils } from "react-admin";
import { Route } from "react-router-dom";
import { authProvider } from "./authProvider";
import { BranchAreaEdit, BranchAreaList } from "./branch-areas";
import { Dashboard } from "./dashboard";import { AdminLayout, theme } from "./layout";
import { DatabasePage, OrganizationCreate, OrganizationEdit, ZoneCreate, ZoneEdit } from "./master-data";
import { GroupEdit, GroupList } from "./groups";
import { PendingGroupEdit, PendingGroupList } from "./pending-groups";
import { PendingUnitEdit, PendingUnitList } from "./pending-units";
import { OperationUnitList, RoleList, SalesUnitList } from "./reference-lists";
import { LeafUnitEdit } from "./unit-edit";
import { UserCreate, UserEdit, UserList } from "./users";
import { YearGate, gated, withYear } from "./year";

// API อยู่ที่เว็บหลัก (src/app/api/admin/*) รูปแบบ ra-data-simple-rest — ทุกคำขอแนบ ?year= ของฐานข้อมูลปีที่เลือก (year.tsx)
const dataProvider = simpleRestProvider("/api/admin", (url, options) => fetchUtils.fetchJson(withYear(url), options));

// หน้าที่แก้ข้อมูลหลักของปีหนึ่ง: ต้องเลือกปีก่อน (มีหลายปี) และมีแถบบอกปีที่กำลังแก้
const SalesUnits = gated(SalesUnitList);
const OperationUnits = gated(OperationUnitList);
const UnitEdit = gated(LeafUnitEdit);
const BranchAreas = gated(BranchAreaList);
const BranchAreaForm = gated(BranchAreaEdit);
const PendingUnits = gated(PendingUnitList);
const PendingUnitForm = gated(PendingUnitEdit);
const Groups = gated(GroupList);
const GroupForm = gated(GroupEdit);
const PendingGroups = gated(PendingGroupList);
const PendingGroupForm = gated(PendingGroupEdit);
const ZoneCreateForm = gated(ZoneCreate);
const ZoneEditForm = gated(ZoneEdit);
const OrgCreateForm = gated(OrganizationCreate);
const OrgEditForm = gated(OrganizationEdit);

export function App() {
  return (
    <Admin
      dataProvider={dataProvider}
      authProvider={authProvider}
      theme={theme}
      layout={AdminLayout}
      dashboard={Dashboard}
      loginPage={false}
      requireAuth
      title="MSP หลังบ้าน"
    >
      <Resource name="users" options={{ label: "ผู้ใช้" }} icon={PeopleIcon} list={UserList} create={UserCreate} edit={UserEdit} recordRepresentation="name" />
      <Resource name="roles" options={{ label: "บทบาท" }} icon={BadgeIcon} list={RoleList} recordRepresentation="name" />      <Resource name="sales-units" options={{ label: "Sales Zone" }} icon={StorefrontIcon} list={SalesUnits} edit={UnitEdit} recordRepresentation="name" />
      <Resource name="operation-units" options={{ label: "Operations" }} icon={FactoryIcon} list={OperationUnits} edit={UnitEdit} recordRepresentation="name" />
      <Resource name="branch-areas" options={{ label: "Branch Area" }} icon={SquareFootIcon} list={BranchAreas} edit={BranchAreaForm} recordRepresentation="code" />
      <Resource name="pending-units" options={{ label: "หน่วยงานใหม่" }} icon={NewReleasesIcon} list={PendingUnits} edit={PendingUnitForm} recordRepresentation="name" />
      <Resource name="groups" options={{ label: "Group" }} icon={ListAltIcon} list={Groups} edit={GroupForm} recordRepresentation="name" />
      <Resource name="pending-groups" options={{ label: "Group ใหม่" }} icon={PlaylistAddIcon} list={PendingGroups} edit={PendingGroupForm} recordRepresentation="name" />
      {/* ไม่มีหน้าในเมนู: units ใช้เลือกสิทธิ์หน่วยในหน้าผู้ใช้
          zones / organizations แสดงรวมในหน้า แก้ไขฐานข้อมูล (/database) — Resource มีแค่ฟอร์มเพิ่ม/แก้
          categories ใช้เป็นตัวเลือกประเภทในฟอร์มหน่วย (อ่านอย่างเดียว) */}
      <Resource name="units" recordRepresentation="name" />
      <Resource name="zones" create={ZoneCreateForm} edit={ZoneEditForm} recordRepresentation="name" />
      <Resource name="organizations" create={OrgCreateForm} edit={OrgEditForm} recordRepresentation="name" />
      <Resource name="categories" recordRepresentation="name" />
      <CustomRoutes>
        <Route path="/database" element={<YearGate><DatabasePage /></YearGate>} />
      </CustomRoutes>
    </Admin>
  );
}
