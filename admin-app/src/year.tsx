import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Box, ButtonBase, Card, Skeleton, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Title, useRefresh } from "react-admin";
import { useLocation, useNavigate } from "react-router-dom";
import { C } from "./layout";

// ฐานข้อมูลหลักแยกตามปี (ผังหน่วย โซน หน่วยงาน Group ตร.ม. หน่วย/Group ใหม่) — ทุกคำขอไป /api/admin แนบ ?year= ของปีที่เลือก
// มีหลายปี: เข้าหน้าที่แยกตามปีครั้งแรกต้องเลือกปีก่อน (YearGate) · มีปีเดียว: เลือกให้อัตโนมัติ
// ปีที่เลือกจำไว้ในแท็บนี้ (sessionStorage) — เปิดแท็บใหม่ต้องเลือกใหม่ กันแก้ผิดปีเพราะลืมว่าค้างปีไหนไว้

export type YearInfo = { year: number; yearBE: number; fileName: string | null; periods: string[] };

const KEY = "msp-admin-year";
/** ปีที่เลือก (ค.ศ.) — อ่านจากตัวช่วยเรียก API นอก React (withYear) */
let current: number | null = null;

/** แนบ ?year= ของปีที่เลือกให้ URL ของ API (ยังไม่เลือก = ไม่แนบ → API ใช้ปีล่าสุด) */
export function withYear(url: string): string {
  if (current === null) return url;
  const u = new URL(url, window.location.origin);
  u.searchParams.set("year", String(current));
  return /^https?:/.test(url) ? u.toString() : `${u.pathname}${u.search}`;
}

const readSaved = () => {
  try {
    return Number(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
};
const save = (year: number) => {
  try {
    sessionStorage.setItem(KEY, String(year));
  } catch {
    // เก็บไม่ได้ (โหมดส่วนตัว ฯลฯ) — ใช้ได้จนรีเฟรช
  }
};

type YearState = { years: YearInfo[]; year: number | null; setYear: (year: number) => void };
const YearContext = createContext<YearState>({ years: [], year: null, setYear: () => {} });
export const useYear = () => useContext(YearContext);

/** โหลดรายการปีก่อนแสดงหน้า (ต้องรู้ปีก่อนคำขออื่น) · วางไว้ใน Layout จึงใช้ router/refresh ของ react-admin ได้ */
export function YearProvider({ children }: { children: ReactNode }) {
  const [years, setYears] = useState<YearInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYearState] = useState<number | null>(null);
  const refresh = useRefresh();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/years", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message ?? `โหลดรายการปีไม่สำเร็จ (${res.status})`);
        return data as YearInfo[];
      })
      .then((list) => {
        if (!alive) return;
        const saved = readSaved();
        const pick = list.length === 1 ? list[0].year : list.some((y) => y.year === saved) ? saved : null;
        current = pick;
        setYearState(pick);
        setYears(list);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const setYear = useCallback(
    (next: number) => {
      if (next === current) return;
      const switching = current !== null;
      current = next;
      save(next);
      setYearState(next);
      if (!switching) return;
      // เปลี่ยนปีระหว่างแก้รายการ: รายการเดิมอาจไม่มีในปีใหม่ → กลับไปหน้ารายการ · โหลดข้อมูลทุกหน้าใหม่ด้วยปีใหม่
      const [, resource, id] = pathname.split("/");
      if (resource && id) navigate(`/${resource}`);
      refresh();
    },
    [navigate, pathname, refresh],
  );

  if (error) {
    return (
      <Card sx={{ m: 3, p: 3, display: "flex", gap: 1.5, alignItems: "flex-start", maxWidth: 640 }}>
        <ErrorOutlineIcon sx={{ color: "#b4161f" }} />
        <Box>
          <Typography sx={{ fontWeight: 600 }}>โหลดรายการปีไม่สำเร็จ</Typography>
          <Typography variant="body2" sx={{ color: C.ink2 }}>{error} — รีเฟรชหน้าเพื่อลองใหม่</Typography>
        </Box>
      </Card>
    );
  }
  if (!years) return <Skeleton variant="rounded" height={120} sx={{ m: 3, maxWidth: 640 }} />;
  return <YearContext.Provider value={{ years, year, setYear }}>{children}</YearContext.Provider>;
}

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthOf = (p: string) => MONTHS[Number(p.slice(5, 7)) - 1];
const monthsLabel = (ps: string[]) => (ps.length === 0 ? "ยังไม่มีไฟล์ Master ที่ใช้อยู่" : ps.length === 1 ? monthOf(ps[0]) : `${monthOf(ps[0])} – ${monthOf(ps[ps.length - 1])} · ${ps.length} เดือน`);

/** หน้าที่แยกตามปี: ยังไม่เลือกปี (มีหลายปี) → ให้เลือกก่อน · เลือกแล้ว → เนื้อหา (ปีที่กำลังแก้อยู่ที่แถบบน YearBar) */
export function YearGate({ children }: { children: ReactNode }) {
  const { years, year, setYear } = useYear();
  if (year === null) return <YearChooser years={years} onPick={setYear} />;
  return <>{children}</>;
}

/** หน้า (ส่วนแรกของ path) ที่แสดงข้อมูลของปีที่เลือก — แถบบนแสดงตัวเลือกปีเฉพาะหน้าเหล่านี้ · "" = ภาพรวม */
const YEAR_PAGES = new Set(["", "sales-units", "operation-units", "branch-areas", "pending-units", "groups", "pending-groups", "database", "zones", "organizations"]);
export const isYearPage = (pathname: string) => YEAR_PAGES.has(pathname.split("/")[1] ?? "");

/** ห่อหน้าของ Resource ให้ต้องเลือกปีก่อน (ใช้ใน App.tsx) */
export const gated = <P extends object>(Page: (props: P) => ReactNode) => {
  const Gated = (props: P) => (
    <YearGate>
      <Page {...props} />
    </YearGate>
  );
  return Gated;
};

function YearChooser({ years, onPick }: { years: YearInfo[]; onPick: (year: number) => void }) {
  return (
    <Box sx={{ py: 3, px: { xs: 0, sm: 1 }, maxWidth: 760 }}>
      <Title title="เลือกฐานข้อมูลปี" />
      <Typography component="h1" sx={{ fontFamily: '"Prompt", "Noto Sans Thai", sans-serif', fontWeight: 600, fontSize: "1.25rem", color: C.ink }}>
        เลือกฐานข้อมูลปีที่จะแก้
      </Typography>
      <Typography variant="body2" sx={{ color: C.ink2, mt: 0.5, mb: 2.5, maxWidth: "62ch" }}>
        ผังหน่วย โซน Group ตร.ม. และหน่วย/Group ใหม่ที่ตรวจพบ แยกเก็บเป็นของแต่ละปี — แก้ปีหนึ่งแล้วงบของปีอื่นไม่เปลี่ยน
      </Typography>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fill, minmax(220px, 1fr))" } }}>
        {years.map((y, i) => (
          <ButtonBase
            key={y.year}
            onClick={() => onPick(y.year)}
            sx={{
              display: "block",
              textAlign: "left",
              p: 2,
              borderRadius: "14px",
              border: `1px solid ${C.line}`,
              backgroundColor: C.paper,
              transition: "border-color 150ms, background-color 150ms",
              "&:hover": { borderColor: C.brand, backgroundColor: C.brandSoft },
              "&.Mui-focusVisible": { outline: `2px solid ${C.accent}`, outlineOffset: 2 },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CalendarMonthIcon fontSize="small" sx={{ color: C.brand }} />
              <Typography sx={{ fontWeight: 700, fontSize: "1.125rem", color: C.brand, fontVariantNumeric: "tabular-nums" }}>ปี {y.yearBE}</Typography>
              {i === 0 && <Typography component="span" sx={{ ml: "auto", fontSize: "0.75rem", color: C.ink3 }}>ล่าสุด</Typography>}
            </Box>
            <Typography sx={{ mt: 1, fontSize: "0.8125rem", color: C.ink2 }}>{monthsLabel(y.periods)}</Typography>
            {y.fileName && (
              <Typography sx={{ mt: 0.25, fontSize: "0.75rem", color: C.ink3, overflowWrap: "anywhere" }}>{y.fileName}</Typography>
            )}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

/**
 * ตัวเลือกปีในแถบบน (เฉพาะหน้าที่แยกตามปี): ปีที่กำลังแก้ + ปุ่มเปลี่ยนปี (มีปีเดียว = บอกปีอย่างเดียว)
 * อยู่ในแถบบนไม่ใช่ในเนื้อหา — ตารางรายการสูงพอดีจอ ถ้ามีแถบเพิ่มในเนื้อหาหน้าจะล้นจอและเลื่อนเอง
 * หน้าภาพรวม (ไม่บังคับเลือก): ยังไม่เลือก = แสดงปีล่าสุด ไม่มีปุ่มไหนถูกเลือก · หน้าเลือกปี (ยังไม่เลือก) ไม่แสดง
 */
export function YearBar() {
  const { years, year, setYear } = useYear();
  const { pathname } = useLocation();
  if (years.length === 0 || !isYearPage(pathname) || (year === null && pathname !== "/")) return null;
  const info = years.find((y) => y.year === (year ?? years[0].year));
  return (
    <Box role="region" aria-label="ฐานข้อมูลปี" sx={{ display: "flex", alignItems: "center", gap: 1.25, mx: 2, minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.8125rem", color: C.ink2, whiteSpace: "nowrap", display: { xs: "none", sm: "block" } }}>ฐานข้อมูลปี</Typography>
      {years.length > 1 ? (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={year}
          onChange={(_e, v: number | null) => v !== null && setYear(v)}
          aria-label="เปลี่ยนฐานข้อมูลปี"
          sx={{
            backgroundColor: C.paper,
            "& .MuiToggleButton-root": { px: 1.5, py: 0.25, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: C.ink2, borderColor: C.lineStrong },
            "& .MuiToggleButton-root.Mui-selected": { backgroundColor: C.brand, color: "#fff", "&:hover": { backgroundColor: C.brand } },
          }}
        >
          {years.map((y) => (
            <ToggleButton key={y.year} value={y.year}>{y.yearBE}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      ) : (
        <Typography sx={{ fontWeight: 700, color: C.brand, fontVariantNumeric: "tabular-nums" }}>{info?.yearBE}</Typography>
      )}
      <Typography noWrap sx={{ fontSize: "0.75rem", color: C.ink3, display: { xs: "none", md: "block" } }}>
        {year === null ? `ยังไม่ได้เลือก — แสดงปีล่าสุด (${info?.yearBE})` : `${info ? monthsLabel(info.periods) : ""} · แก้แล้วมีผลเฉพาะปีนี้`}
      </Typography>
    </Box>
  );
}
