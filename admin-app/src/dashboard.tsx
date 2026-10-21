import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Box, Button as MuiButton, Card, Chip, Skeleton, Typography, keyframes } from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";
import { Link, Title, useCheckAuth } from "react-admin";
import { getJson } from "./api";
import { C, MOTION } from "./layout";
import { useYear } from "./year";

// หน้าแรกของแอปหลังบ้าน: ยอดรวมของทุกเมนู + สิ่งที่ต้องจัดการ — ข้อมูลจาก /api/admin/overview (คำขอเดียว)
// หน่วยงาน/หน่วยงานใหม่/Group ใหม่/ไฟล์ Master เป็นของฐานข้อมูลปีที่เลือก (ยังไม่เลือก = ปีล่าสุด)

type Overview = {
  users: {
    total: number;
    active: number;
    sso: number;
    noRole: number;
    byRole: { id: number; name: string; count: number }[];
    recent: { id: number; name: string; username: string; isActive: boolean; createdAt: string }[];
  };
  units: { sales: number; operations: number; byZone: { zone: string; sales: number; operations: number }[] };
  pending: {
    total: number;
    noZone: number;
    latest: { id: string; name: string; sheet: string; zoneName: string | null; detectedAt: string }[];
  };
  master: { fileName: string; createdAt: string; by: string | null; periods: string[]; lineCount: number } | null;
  backupPending: number;
  pendingGroups: number;
};

/** สีของแถบ Operations: น้ำเงินอ่อนคู่กับ Sales Zone (กรมท่า) — ต่างกันพอเห็นทั้งสองสี และมีตัวเลขกำกับเสมอ */
const OPS = "#8fb0e3";
const num = new Intl.NumberFormat("en-US");
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-08-01" → "ส.ค. 69" */
const shortPeriod = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(y + 543).slice(-2)}`;
};
const periodRange = (ps: string[]) => (ps.length > 1 ? `${shortPeriod(ps[0])} – ${shortPeriod(ps[ps.length - 1])}` : shortPeriod(ps[0]));
const dateTH = (iso: string, time = false) =>
  new Date(iso).toLocaleString("th-TH", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });

// แถบจางเข้า (ไม่ยืด/ย่อ)
const grow = keyframes`from { opacity: 0; } to { opacity: 1; }`;

export function Dashboard() {
  const checkAuth = useCheckAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { year } = useYear();

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getJson<Overview>("/overview")
      .then((d) => alive && setData(d))
      .catch((e: { status?: number; message?: string }) => {
        if (!alive) return;
        if (e.status === 401) checkAuth();
        setError(e.message ?? "โหลดข้อมูลไม่สำเร็จ");
      });
    return () => {
      alive = false;
    };
  }, [checkAuth, year]);

  return (
    <Box className="admin-dashboard" sx={{ py: 3, px: { xs: 0, sm: 1 }, maxWidth: 1240 }}>
      <Title title="ภาพรวม" />
      {/* ชื่อหน้าอยู่ที่แถบบนแล้ว (Title) — ตรงนี้บอกแค่ว่าตัวเลขมาจากไฟล์ไหน */}
      <Typography variant="body2" sx={{ color: C.ink3, mb: 2, minHeight: "1.5em" }}>
        {data?.master ? (
          <>
            ข้อมูลจาก <Box component="span" sx={{ color: C.ink2, fontWeight: 500 }}>{data.master.fileName}</Box> ({periodRange(data.master.periods)})
            {" "}นำเข้าเมื่อ {dateTH(data.master.createdAt, true)}
          </>
        ) : (
          data && "ยังไม่มีไฟล์ Master ในระบบ — นำเข้าได้ที่หน้า Upload Data ของ Dashboard"
        )}
      </Typography>

      {error ? (
        <Card sx={{ p: 3, display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <ErrorOutlineIcon sx={{ color: "#b4161f" }} />
          <Box>
            <Typography sx={{ fontWeight: 600 }}>โหลดภาพรวมไม่สำเร็จ</Typography>
            <Typography variant="body2" sx={{ color: C.ink2 }}>{error} — รีเฟรชหน้าเพื่อลองใหม่</Typography>
          </Box>
        </Card>
      ) : !data ? (
        <Loading />
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Todo data={data} />
          <StatStrip data={data} />
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.65fr) minmax(0, 1fr)" } }}>
            <ZoneCard zones={data.units.byZone} />
            <RoleCard users={data.users} />
          </Box>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.65fr) minmax(0, 1fr)" }, alignItems: "start" }}>
            <PendingCard pending={data.pending} />
            <RecentUsersCard users={data.users.recent} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** สิ่งที่ต้องจัดการ — แสดงเฉพาะเรื่องที่มีอยู่จริง ไม่มีเลย = บรรทัดยืนยันว่าเรียบร้อย */
function Todo({ data }: { data: Overview }) {
  const items: { text: ReactNode; to: string | null; action: string }[] = [];
  if (data.pending.total > 0) {
    items.push({
      text: (
        <>
          <b>{data.pending.total} หน่วยงานใหม่</b> รอเลือกประเภท ยอดยังไม่นับใน Dashboard
          {data.pending.noZone > 0 && ` (${data.pending.noZone} หน่วยต้องเลือกโซนก่อน)`}
        </>
      ),
      to: "/pending-units",
      action: "เลือกประเภท",
    });
  }
  if (data.pendingGroups > 0) {
    items.push({
      text: <><b>{data.pendingGroups} Group ใหม่</b> รอเลือกหมวด (ต้นทุน/ค่าใช้จ่าย) ยอดยังไม่นับในงบ</>,
      to: "/pending-groups",
      action: "เลือกหมวด",
    });
  }
  if (data.users.noRole > 0) {
    items.push({ text: <><b>{data.users.noRole} ผู้ใช้</b> ยังไม่มีบทบาท เข้าระบบได้แต่ไม่เห็นข้อมูล</>, to: "/users", action: "ดูผู้ใช้" });
  }
  if (data.backupPending > 0) {
    items.push({ text: <><b>{data.backupPending} ไฟล์ Master เดิม</b> ยังไม่ได้ backup ขึ้น Google Drive</>, to: null, action: "" });
  }

  if (items.length === 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: C.ink2, fontSize: "0.875rem" }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "#15803d" }} />
        ไม่มีรายการที่ต้องจัดการ
      </Box>
    );
  }

  return (
    <Card sx={{ borderColor: "#f3d9a8", bgcolor: "#fffaf0" }}>
      {items.map((it, i) => (
        <Box
          key={i}
          sx={{
            display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", px: 2.5, py: 1.5,
            borderTop: i ? "1px solid #f3e3c4" : "none", fontSize: "0.875rem", color: C.ink2,
            "& b": { color: C.ink, fontWeight: 600 },
          }}
        >
          <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#d97706", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 220 }}>{it.text}</Box>
          {it.to && (
            <MuiButton component={Link} to={it.to} size="small" endIcon={<ArrowForwardIcon />} sx={{ color: "#92400e", "&:hover": { bgcolor: "#fdefd6" } }}>
              {it.action}
            </MuiButton>
          )}
        </Box>
      ))}
    </Card>
  );
}

/** ยอดหลักสี่ช่องในแถบเดียว — แต่ละช่องกดไปหน้ารายการนั้น */
function StatStrip({ data }: { data: Overview }) {
  const stats = [
    { label: "ผู้ใช้", value: data.users.total, note: `ใช้งาน ${data.users.active} · ปิด ${data.users.total - data.users.active}`, to: "/users" },
    { label: "Sales Zone", value: data.units.sales, note: "สาขาขาย", to: "/sales-units" },
    { label: "Operations", value: data.units.operations, note: "สำนักงาน โรงงาน ขนส่ง ฟาร์ม", to: "/operation-units" },
    {
      label: "หน่วยงานใหม่",
      value: data.pending.total,
      note: data.pending.total ? "รอเลือกประเภท" : "ไม่มีหน่วยรอ",
      to: "/pending-units",
      warn: data.pending.total > 0,
    },
  ];
  return (
    <Card sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, overflow: "hidden" }}>
      {stats.map((s) => (
        <Box
          key={s.label}
          component={Link}
          to={s.to}
          sx={{
            display: "block", px: 2.5, py: 2, color: "inherit", textDecoration: "none",
            // เส้นแบ่งช่องด้วยเงา 1px ด้านซ้าย/บน ส่วนที่ล้นขอบถูกตัด จึงไม่ต้องคำนวณว่าช่องไหนอยู่ขอบ
            boxShadow: `-1px 0 0 ${C.line}, 0 -1px 0 ${C.line}`,
            transition: `background-color ${MOTION.fast}ms ${MOTION.easeInOut}`,
            "&:hover": { bgcolor: C.hover },
            "&:hover .stat-go": { opacity: 1, transform: "none" },
            "&:focus-visible": { outline: `2px solid ${C.accent}`, outlineOffset: -2 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: C.ink2, fontSize: "0.8125rem", fontWeight: 500 }}>
            {s.label}
            <ArrowForwardIcon
              className="stat-go"
              aria-hidden
              sx={{ fontSize: 16, color: C.ink3, opacity: 0, transform: "translateX(-4px)", transition: `opacity ${MOTION.fast}ms, transform ${MOTION.base}ms ${MOTION.easeOut}` }}
            />
          </Box>
          <Typography
            sx={{
              fontFamily: '"Prompt", sans-serif', fontWeight: 600, fontSize: "2rem", lineHeight: 1.25, mt: 0.5,
              fontVariantNumeric: "tabular-nums", color: s.warn ? "#b45309" : C.ink,
            }}
          >
            {num.format(s.value)}
          </Typography>
          <Typography variant="caption" sx={{ color: C.ink3, display: "block" }}>{s.note}</Typography>
        </Box>
      ))}
    </Card>
  );
}

function CardHead({ title, caption, action }: { title: string; caption?: string; action?: ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap", px: 2.5, pt: 2.25, pb: 1.5 }}>
      <Box>
        <Typography component="h2" sx={{ fontFamily: '"Prompt", sans-serif', fontWeight: 600, fontSize: "1rem", color: C.ink }}>{title}</Typography>
        {caption && <Typography variant="caption" sx={{ color: C.ink3 }}>{caption}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

function Legend() {
  const dot = (color: string, label: string) => (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: color }} />
      {label}
    </Box>
  );
  return (
    <Box sx={{ display: "flex", gap: 2, fontSize: "0.75rem", color: C.ink2, pt: 0.5 }}>
      {dot(C.brand, "Sales Zone")}
      {dot(OPS, "Operations")}
    </Box>
  );
}

/** หน่วยงานตามโซน: แถบซ้อน Sales + Operations ยาวตามจำนวนเทียบโซนที่มากที่สุด · แถบจางเข้าตอนเปิดหน้า (ครั้งเดียว) */
function ZoneCard({ zones }: { zones: Overview["units"]["byZone"] }) {
  const max = Math.max(1, ...zones.map((z) => z.sales + z.operations));
  const sum = (k: "sales" | "operations") => zones.reduce((s, z) => s + z[k], 0);
  // คอลัมน์: โซน · แถบ · Sales · Ops · รวม (จอแคบซ่อน Sales/Ops เหลือรวม)
  const cols = { xs: "6.5rem minmax(0, 1fr) 2.5rem", sm: "8rem minmax(0, 1fr) 3.5rem 3.5rem 3rem" };
  const numCell = { textAlign: "right", fontVariantNumeric: "tabular-nums" } as const;
  const wide = { display: { xs: "none", sm: "block" } } as const;
  return (
    <Card sx={{ display: "flex", flexDirection: "column" }}>
      <CardHead title="หน่วยงานตามโซน" caption="จำนวนหน่วยที่นับในงบ" action={<Legend />} />
      {zones.length === 0 ? (
        <Empty>ยังไม่มีหน่วยงานในผัง — นำเข้าไฟล์ Master ก่อน</Empty>
      ) : (
        <>
        <Box
          aria-hidden
          sx={{ display: "grid", gridTemplateColumns: cols, gap: 1.5, px: 2.5, pb: 0.75, fontSize: "0.75rem", color: C.ink3 }}
        >
          <span>โซน</span>
          <span />
          <Box sx={{ ...numCell, ...wide }}>Sales</Box>
          <Box sx={{ ...numCell, ...wide }}>Ops</Box>
          <Box sx={numCell}>รวม</Box>
        </Box>
        <Box component="ul" sx={{ listStyle: "none", m: 0, px: 2.5, pb: 2.25, pt: 0.5, display: "grid", gap: 1.5 }}>
          {zones.map((z, i) => {
            const total = z.sales + z.operations;
            return (
              <Box
                component="li"
                key={z.zone}
                aria-label={`${z.zone}: Sales Zone ${z.sales} หน่วย, Operations ${z.operations} หน่วย`}
                sx={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 1.5 }}
              >
                <Typography variant="body2" noWrap title={z.zone} sx={{ color: C.ink2 }}>{z.zone}</Typography>
                <Box
                  aria-hidden
                  title={`Sales Zone ${z.sales} · Operations ${z.operations}`}
                  sx={{
                    display: "flex", height: 12, width: `${(total / max) * 100}%`, minWidth: 4, borderRadius: "4px", overflow: "hidden",
                    animation: `${grow} 500ms ${MOTION.easeOut} both`,
                    animationDelay: `${120 + i * 45}ms`,
                  }}
                >
                  <Box sx={{ flex: z.sales, bgcolor: C.brand }} />
                  {/* ช่องว่าง 2px ระหว่างสองสี ให้แยกออกจากกันได้แม้สีใกล้กัน */}
                  {z.sales > 0 && z.operations > 0 && <Box sx={{ width: 2, bgcolor: C.paper }} />}
                  <Box sx={{ flex: z.operations, bgcolor: OPS }} />
                </Box>
                <Typography aria-hidden variant="body2" sx={{ ...numCell, ...wide, color: C.ink2 }}>{z.sales}</Typography>
                <Typography aria-hidden variant="body2" sx={{ ...numCell, ...wide, color: C.ink2 }}>{z.operations}</Typography>
                <Typography aria-hidden variant="body2" sx={{ ...numCell, fontWeight: 600 }}>{total}</Typography>
              </Box>
            );
          })}
        </Box>
        {/* แถวรวม ชิดล่างการ์ด — การ์ดคู่กันในแถวสูงเท่ากัน เส้นล่างจึงตรงกับการ์ดผู้ใช้ */}
        <Box
          sx={{
            mt: "auto", display: "grid", gridTemplateColumns: cols, gap: 1.5, alignItems: "center",
            px: 2.5, py: 1.5, borderTop: `1px solid ${C.line}`, bgcolor: C.head, fontSize: "0.875rem",
          }}
        >
          <Box sx={{ color: C.ink2, fontWeight: 500 }}>รวม {zones.length} โซน</Box>
          <span />
          <Box sx={{ ...numCell, ...wide, fontWeight: 600 }}>{sum("sales")}</Box>
          <Box sx={{ ...numCell, ...wide, fontWeight: 600 }}>{sum("operations")}</Box>
          <Box sx={{ ...numCell, fontWeight: 700, color: C.brand }}>{sum("sales") + sum("operations")}</Box>
        </Box>
        </>
      )}
    </Card>
  );
}

/** ผู้ใช้ตามบทบาท (ผู้ใช้หนึ่งคนมีได้หลายบทบาท) + สรุปสถานะ */
function RoleCard({ users }: { users: Overview["users"] }) {
  const max = Math.max(1, ...users.byRole.map((r) => r.count));
  return (
    <Card sx={{ display: "flex", flexDirection: "column", "& > :last-child": { mt: "auto" } }}>
      <CardHead title="ผู้ใช้ตามบทบาท" caption="ผู้ใช้หนึ่งคนมีได้หลายบทบาท" />
      <Box component="ul" sx={{ listStyle: "none", m: 0, px: 2.5, pt: 0.5, pb: 2, display: "grid", gap: 1.5 }}>
        {users.byRole.map((r) => (
          <Box component="li" key={r.id}>
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", mb: 0.5 }}>
              <span style={{ color: C.ink2 }}>{r.name}</span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{r.count}</b>
            </Box>
            <Box aria-hidden sx={{ height: 6, borderRadius: 3, bgcolor: C.hover, overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${(r.count / max) * 100}%`, bgcolor: C.accent, borderRadius: 3 }} />
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: `1px solid ${C.line}` }}>
        {[
          { label: "ใช้งาน", value: users.active },
          { label: "ปิดใช้งาน", value: users.total - users.active },
          { label: "เข้าผ่าน SSO", value: users.sso },
        ].map((s, i) => (
          <Box key={s.label} sx={{ px: 2.5, py: 1.5, borderLeft: i ? `1px solid ${C.line}` : "none" }}>
            <Typography variant="caption" sx={{ color: C.ink3, display: "block" }}>{s.label}</Typography>
            <Typography sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{s.value}</Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
}

function PendingCard({ pending }: { pending: Overview["pending"] }) {
  return (
    <Card>
      <CardHead
        title="หน่วยงานใหม่ล่าสุด"
        caption="พบในชีตงบ แต่ยังไม่ได้เลือกว่าเป็น Sales Zone หรือ Operations"
        action={pending.total > 0 && <MuiButton component={Link} to="/pending-units" size="small" endIcon={<ArrowForwardIcon />}>ดูทั้งหมด {pending.total}</MuiButton>}
      />
      {pending.latest.length === 0 ? (
        <Empty>ไม่มีหน่วยงานรอเลือกประเภท</Empty>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, borderTop: `1px solid ${C.line}` }}>
          {pending.latest.map((u) => (
            <Box component="li" key={u.id} sx={{ "& + &": { borderTop: `1px solid ${C.line}` } }}>
              <Box
                component={Link}
                to={`/pending-units/${encodeURIComponent(u.id)}`}
                sx={{
                  display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 1.25, color: "inherit", textDecoration: "none",
                  transition: `background-color ${MOTION.fast}ms`, "&:hover": { bgcolor: C.hover },
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {u.name} <Box component="span" sx={{ color: C.ink3, fontWeight: 400 }}>{u.id}</Box>
                  </Typography>
                  <Typography variant="caption" sx={{ color: C.ink3 }}>ชีต {u.sheet} · พบ {dateTH(u.detectedAt)}</Typography>
                </Box>
                {u.zoneName ? (
                  <Chip size="small" label={u.zoneName} variant="outlined" />
                ) : (
                  <Chip size="small" label="ต้องเลือกโซน" sx={{ bgcolor: "#fef3c7", color: "#92400e" }} />
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}

function RecentUsersCard({ users }: { users: Overview["users"]["recent"] }) {
  return (
    <Card>
      <CardHead title="ผู้ใช้ที่เพิ่มล่าสุด" action={<MuiButton component={Link} to="/users" size="small" endIcon={<ArrowForwardIcon />}>ทั้งหมด</MuiButton>} />
      {users.length === 0 ? (
        <Empty>ยังไม่มีผู้ใช้</Empty>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, borderTop: `1px solid ${C.line}` }}>
          {users.map((u) => (
            <Box component="li" key={u.id} sx={{ "& + &": { borderTop: `1px solid ${C.line}` } }}>
              <Box
                component={Link}
                to={`/users/${u.id}`}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1.25, color: "inherit", textDecoration: "none",
                  transition: `background-color ${MOTION.fast}ms`, "&:hover": { bgcolor: C.hover },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
                    bgcolor: C.brandSoft, color: C.brand, fontSize: "0.8125rem", fontWeight: 600,
                  }}
                >
                  {u.name.trim().charAt(0)}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{u.name}</Typography>
                  <Typography variant="caption" noWrap sx={{ color: C.ink3, display: "block" }}>{u.username} · {dateTH(u.createdAt)}</Typography>
                </Box>
                {!u.isActive && <Chip size="small" label="ปิดใช้งาน" sx={{ bgcolor: C.hover, color: C.ink3 }} />}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <Typography variant="body2" sx={{ color: C.ink3, px: 2.5, pb: 2.5 }}>{children}</Typography>;
}

function Loading() {
  return (
    <Box role="status" aria-busy="true" sx={{ display: "grid", gap: 2 }}>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>กำลังโหลดภาพรวม…</span>
      <Skeleton variant="rounded" height={112} sx={{ borderRadius: "14px" }} />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1.65fr 1fr" } }}>
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: "14px" }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: "14px" }} />
      </Box>
    </Box>
  );
}
