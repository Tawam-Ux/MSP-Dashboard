import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Button as MuiButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { Button, useGetList, useListContext, useNotify, useRefresh, useUnselectAll } from "react-admin";
import { postJson } from "./api";
import { categoryOption, zoneOption } from "./options";

// ปุ่ม "แก้ไขที่เลือก" (หน้า หน่วยงาน Sales Zone / Operations): เปลี่ยน โซน · หน่วยงาน · ประเภท (แสดงหน้าที่) ของหน่วยที่ติ๊กไว้พร้อมกัน
// ช่องที่ปล่อยเป็น "ไม่เปลี่ยน" = คงค่าเดิมของแต่ละหน่วย · เพิ่มหน่วยงานใหม่ได้จากช่องหน่วยงาน
// บันทึกเป็นคำขอเดียว (/api/admin/leaf-units/bulk) ระบบแทนผังและคำนวณงบใหม่ครั้งเดียว

const KEEP = "";
const NEW_ORG = "__new__";

type Option = { id: string; name: string };

/** ข้อความปุ่มสองแบบวางซ้อนกัน — ปุ่มกว้างเท่าข้อความที่ยาวกว่าเสมอ ไม่ย่อหดขยายตอนกำลังทำงาน */
function SwapLabel({ busy, idle, working }: { busy: boolean; idle: string; working: string }) {
  const layer = (on: boolean) => ({ gridArea: "1 / 1", visibility: on ? "visible" : "hidden" }) as const;
  return (
    <span style={{ display: "inline-grid", justifyItems: "center" }}>
      <span style={layer(!busy)}>{idle}</span>
      <span style={layer(busy)} aria-hidden={!busy}>{working}</span>
    </span>
  );
}

function Choice({ label, value, onChange, options, extra }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  extra?: Option;
}) {
  const id = `bulk-${label}`;
  return (
    <FormControl fullWidth size="small">
      <InputLabel id={id}>{label}</InputLabel>
      <Select labelId={id} label={label} value={value} onChange={(e) => onChange(String(e.target.value))}>
        <MenuItem value={KEEP}><em>— ไม่เปลี่ยน —</em></MenuItem>
        {options.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
        {extra && <MenuItem value={extra.id} sx={{ color: "primary.main" }}>{extra.name}</MenuItem>}
      </Select>
    </FormControl>
  );
}

/**
 * ปุ่ม "ลบ" (ข้าง แก้ไขที่เลือก): ลบหน่วยที่ติ๊กไว้ออกจากผัง — ไม่นับใน Dashboard และสิทธิ์ผู้ใช้ที่ผูกกับหน่วยถูกลบ
 * นำเข้าไฟล์ครั้งถัดไปแล้วหน่วยยังมียอด จะไปรอที่หน้า หน่วยงานใหม่ ให้เลือกคืนได้
 */
export function BulkDeleteButton() {
  const { selectedIds, resource } = useListContext();
  const unselectAll = useUnselectAll(resource);
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await postJson("/leaf-units/delete", { ids: selectedIds });
      notify(`ลบ ${selectedIds.length} หน่วยออกจากผังแล้ว — คำนวณงบใหม่เรียบร้อย`, { type: "success" });
      unselectAll();
      setOpen(false);
      refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "ลบไม่สำเร็จ", { type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button label="ลบ" onClick={() => setOpen(true)} color="error"><DeleteIcon /></Button>
      <Dialog open={open} onClose={deleting ? undefined : () => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>ลบ {selectedIds.length} หน่วยออกจากผัง?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {selectedIds.slice(0, 8).join(", ")}{selectedIds.length > 8 ? ` และอีก ${selectedIds.length - 8} หน่วย` : ""}
          </Typography>
          <Typography variant="body2" color="error">
            ยอดของหน่วยเหล่านี้จะไม่นับใน Dashboard และสิทธิ์ผู้ใช้ที่ผูกกับหน่วยจะถูกลบ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            ถ้านำเข้าไฟล์ครั้งถัดไปแล้วหน่วยยังมียอด จะไปรอที่หน้า หน่วยงานใหม่ ให้เลือกคืนได้
          </Typography>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setOpen(false)} disabled={deleting}>ยกเลิก</MuiButton>
          <MuiButton variant="contained" color="error" onClick={remove} disabled={deleting}>
<SwapLabel busy={deleting} idle="ยืนยันลบ" working="กำลังลบและคำนวณ…" />
          </MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function BulkEditButton() {
  const { selectedIds, resource } = useListContext();
  const unselectAll = useUnselectAll(resource);
  const notify = useNotify();
  const refresh = useRefresh();
  const sort = { field: "order", order: "ASC" as const };
  const { data: zoneRows = [] } = useGetList<Option & { label: string }>("zones", { pagination: { page: 1, perPage: 100 }, sort });
  const { data: orgs = [], refetch: refetchOrgs } = useGetList<Option>("organizations", { pagination: { page: 1, perPage: 100 }, sort });
  const { data: categoryRows = [] } = useGetList<Option & { page: string }>("categories", { pagination: { page: 1, perPage: 100 }, sort });
  const zones = zoneRows.map((z) => ({ id: z.id, name: zoneOption(z) }));
  const categories = categoryRows.map((c) => ({ id: c.id, name: categoryOption(c) }));

  const [open, setOpen] = useState(false);
  const [zoneCode, setZoneCode] = useState(KEEP);
  const [orgCode, setOrgCode] = useState(KEEP);
  const [newOrgName, setNewOrgName] = useState("");
  const [category, setCategory] = useState(KEEP);
  const [saving, setSaving] = useState(false);
  const newOrgRef = useRef<HTMLInputElement>(null);

  // เลือก + เพิ่มหน่วยงานใหม่ → โฟกัสช่องชื่อ (ช่องแสดงอยู่แล้วแต่ปิดไว้ — รอให้เปิดใช้งานก่อนแล้วจึงโฟกัส)
  useEffect(() => {
    if (orgCode === NEW_ORG) newOrgRef.current?.focus();
  }, [orgCode]);

  const close = () => {
    setOpen(false);
    setZoneCode(KEEP);
    setOrgCode(KEEP);
    setNewOrgName("");
    setCategory(KEEP);
  };

  const nothing = !zoneCode && !orgCode && !category;
  const missingNewName = orgCode === NEW_ORG && !newOrgName.trim();

  const save = async () => {
    setSaving(true);
    try {
      let targetOrg = orgCode || undefined;
      if (orgCode === NEW_ORG) {
        const org = await postJson<{ code: string }>("/organizations", { name: newOrgName.trim() });
        targetOrg = org.code;
        refetchOrgs();
      }
      await postJson("/leaf-units/bulk", {
        ids: selectedIds,
        changes: { zoneCode: zoneCode || undefined, orgCode: targetOrg, category: category || undefined },
      });
      notify(`แก้ ${selectedIds.length} หน่วยแล้ว — คำนวณงบใหม่เรียบร้อย`, { type: "success" });
      unselectAll();
      close();
      refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button label="แก้ไขที่เลือก" onClick={() => setOpen(true)}><EditIcon /></Button>
      <Dialog open={open} onClose={saving ? undefined : close} fullWidth maxWidth="xs">
        <DialogTitle>แก้ไข {selectedIds.length} หน่วย</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            <Choice label="โซน" value={zoneCode} onChange={setZoneCode} options={zones} />
            <Choice label="หน่วยงาน" value={orgCode} onChange={setOrgCode} options={orgs} extra={{ id: NEW_ORG, name: "+ เพิ่มหน่วยงานใหม่…" }} />
            {/* แสดงตลอด (ปิดไว้จนกว่าจะเลือก + เพิ่มหน่วยงานใหม่) กล่องจึงไม่สูงขึ้นตอนเลือก */}
            <TextField
              label="ชื่อหน่วยงานใหม่"
              size="small"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              disabled={orgCode !== NEW_ORG}
              required={orgCode === NEW_ORG}
              inputRef={newOrgRef}
              helperText={orgCode === NEW_ORG ? " " : "ใช้เมื่อเลือก + เพิ่มหน่วยงานใหม่"}
            />
            <Choice label="ประเภท" value={category} onChange={setCategory} options={categories} />
            <Typography variant="body2" color="text.secondary">
              ช่องที่ไม่เปลี่ยนคงค่าเดิมของแต่ละหน่วย · ประเภทที่แสดงอีกหน้า → หน่วยย้ายไปอยู่หน้านั้น
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={close} disabled={saving}>ยกเลิก</MuiButton>
          <MuiButton variant="contained" onClick={save} disabled={saving || nothing || missingNewName}>
<SwapLabel busy={saving} idle="บันทึก" working="กำลังบันทึกและคำนวณ…" />
          </MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
