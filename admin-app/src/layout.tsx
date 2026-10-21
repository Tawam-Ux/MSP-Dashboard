import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import StorageIcon from "@mui/icons-material/Storage";
import { Box, ListItemIcon, MenuItem } from "@mui/material";
import { AppBar, Layout, Menu, TitlePortal, defaultTheme, type LayoutProps, type RaThemeOptions } from "react-admin";
import { DASHBOARD_URL } from "./config";
import { YearBar, YearProvider } from "./year";

// ธีมแอปหลังบ้าน: เรียบ สะอาด — พื้นเทาอ่อน การ์ดขาวเส้นขอบบางแทนเงา แถบบนสีขาว ตัวอักษรไม่เป็นตัวพิมพ์ใหญ่ทั้งหมด
// แอนิเมชันใช้ค่ากลางชุดเดียว (motion tokens): เข้า = ชะลอท้าย (ease-out), ออก = เร็วกว่าเข้า, hover = สั้น
// ผู้ใช้ที่ตั้ง "ลดการเคลื่อนไหว" ในระบบ → ปิดแอนิเมชันทั้งหมด

export const C = {
  brand: "#0b2a5b",
  brandSoft: "#e9eef7",
  /** พื้นของเมนูที่เลือกอยู่ (สีอ่อน) — คู่กับตัวอักษร/ไอคอนสีแบรนด์ตัวหนา จึงไม่ต้องมีแถบเส้น */
  brandSelected: "#e3eaf6",
  accent: "#2563eb",
  bg: "#f6f7f9",
  paper: "#ffffff",
  line: "#e5e7eb",
  lineStrong: "#d1d5db",
  /** ขอบช่องกรอก: คอนทราสต์ ≥3:1 ทั้งบนพื้นขาว (3.31) และพื้นหน้า (3.08) */
  field: "#848e9f",
  ink: "#0f172a",
  ink2: "#475569",
  ink3: "#64748b",
  hover: "#f1f5f9",
  head: "#f8fafc",
};

export const MOTION = {
  fast: 150, // hover / สีเปลี่ยน
  base: 220, // เข้า (หน้า เมนู กล่อง)
  exit: 160, // ออก (เร็วกว่าเข้า)
  sidebar: 300,
  easeOut: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
};
const reducedMotion = "@media (prefers-reduced-motion: reduce)";
const ease = (props: string, ms = MOTION.fast) => props.split(",").map((p) => `${p.trim()} ${ms}ms ${MOTION.easeInOut}`).join(", ");

export const theme: RaThemeOptions = {
  ...defaultTheme,
  palette: {
    primary: { main: C.brand },
    secondary: { main: C.accent },
    background: { default: C.bg, paper: C.paper },
    text: { primary: C.ink, secondary: C.ink2 },
    divider: C.line,
  },
  shape: { borderRadius: 10 },
  // เมนูย่อกว้าง 56 (react-admin ตั้ง 55 = เลขคี่ → ขอบซ้ายขวา 7.5px ถูกปัดคนละทาง กรอบรอบไอคอนซ้าย-ขวาไม่เท่ากัน)
  // 56 = ขอบ 8 + กล่องไอคอน 40 + ขอบ 8 → ทุกค่าเป็นจำนวนเต็ม พิกเซลตรงกัน
  sidebar: { width: 240, closedWidth: 56 },
  typography: {
    fontFamily: '"Noto Sans Thai", system-ui, sans-serif',
    h6: { fontFamily: '"Prompt", "Noto Sans Thai", sans-serif', fontWeight: 600, letterSpacing: 0 },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
  },
  transitions: {
    duration: { enteringScreen: MOTION.base, leavingScreen: MOTION.exit, standard: MOTION.base, short: MOTION.fast, shorter: MOTION.fast },
  },
  components: {
    ...defaultTheme.components,

    // ---------- พื้นฐาน + แอนิเมชันเปิดหน้า ----------
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: C.bg, WebkitFontSmoothing: "antialiased" },
        "@keyframes ra-page-in": {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "none" },
        },
        // เปลี่ยนหน้า (รายการ/แก้ไข/สร้าง): เนื้อหาจางเข้าและเลื่อนขึ้นเล็กน้อย
        ".RaList-main, .RaEdit-main, .RaCreate-main, .admin-dashboard": { animation: `ra-page-in ${MOTION.base + 60}ms ${MOTION.easeOut} both` },
        [reducedMotion]: {
          "*, *::before, *::after": { animationDuration: "1ms !important", transitionDuration: "1ms !important" },
        },
      },
    },
    MuiButtonBase: { defaultProps: { disableRipple: false } },

    // ---------- แถบบน: ขาว เส้นขอบล่าง ไม่มีเงา ----------
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundColor: C.paper, color: C.ink, borderBottom: `1px solid ${C.line}` },
        colorSecondary: { backgroundColor: C.paper, color: C.ink },
      },
    },

    // ---------- การ์ด/กล่อง: เส้นขอบบางแทนเงา ----------
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: C.line },
      },
    },
    // การ์ดเนื้อหา (ตารางรายการ ฟอร์ม) — เส้นขอบเฉพาะการ์ด ไม่ใส่ให้แถบบน/เมนูที่เป็น Paper เหมือนกัน
    MuiCard: { styleOverrides: { root: { borderRadius: 14, border: `1px solid ${C.line}` } } },

    // ---------- ปุ่ม ----------
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          // ไม่ย่อปุ่มตอนกด (ระบบนี้ไม่มีองค์ประกอบที่ย่อหดขยาย) — ใช้สีพื้น/ripple บอกการกดแทน
          transition: ease("background-color, color, border-color, box-shadow"),
          "&.Mui-focusVisible": { outline: `2px solid ${C.accent}`, outlineOffset: 2 },
        },
        contained: { boxShadow: "none", "&:hover": { boxShadow: "none" } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: ease("background-color, color"),
          "&.Mui-focusVisible": { outline: `2px solid ${C.accent}`, outlineOffset: 2 },
        },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 6, fontWeight: 500 } } },

    // ---------- ช่องกรอก (react-admin ใช้แบบ filled) ----------
    // พื้นขาว + ขอบเทากลาง (ไม่ใช้เทาบนเทา ซึ่งมองไม่เห็นขอบช่องบนพื้นหน้า) · โฟกัส = ขอบน้ำเงิน + วงสีจาง
    MuiFilledInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: C.paper,
          boxShadow: `inset 0 0 0 1px ${C.field}`,
          transition: ease("background-color, box-shadow"),
          "&:hover": { backgroundColor: C.paper, boxShadow: `inset 0 0 0 1px ${C.ink3}` },
          "&.Mui-focused": { backgroundColor: C.paper, boxShadow: `inset 0 0 0 2px ${C.accent}, 0 0 0 3px rgba(37, 99, 235, 0.15)` },
          "&.Mui-disabled": { backgroundColor: C.head, boxShadow: `inset 0 0 0 1px ${C.line}` },
          "&::before, &::after": { display: "none" },
          "&.Mui-error": { boxShadow: "inset 0 0 0 2px #dc2626" },
          // ข้อความตัวอย่าง: ค่าเริ่มต้น MUI ทึบแค่ 42% (จางเกินอ่าน) → สีเทาเข้มทึบเต็ม (คอนทราสต์ ~4.7:1 บนพื้นขาว)
          "& input::placeholder, & textarea::placeholder": { color: C.ink3, opacity: 1 },
          "& .MuiInputAdornment-root, & .MuiSvgIcon-root": { color: C.ink3 },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: C.ink2, "&.Mui-focused": { color: C.accent } } } },

    // ---------- ตาราง: หัวตารางเทาอ่อน แถวชี้แล้วเปลี่ยนสีนุ่มๆ ----------
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${C.line}` },
        head: { backgroundColor: C.head, color: C.ink2, fontWeight: 600, fontSize: "0.8125rem" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: ease("background-color"),
          "&.MuiTableRow-hover:hover": { backgroundColor: C.hover },
          "&.Mui-selected, &.Mui-selected:hover": { backgroundColor: C.brandSoft },
        },
      },
    },
    // ---------- Freeze หัวตาราง (ทุกหน้ารายการ) ----------
    // ตารางเลื่อนในกรอบของตัวเอง (สูงพอดีจอ หักแถบบน แถบค้นหา และแถบเปลี่ยนหน้า) หัวตารางติดอยู่ด้านบนกรอบ
    // react-admin ตั้งหัวตาราง sticky ไว้แล้ว แต่การ์ดรายการตัดส่วนล้น (overflow) หัวจึงไม่ติดถ้าเลื่อนทั้งหน้า
    // ตารางที่กว้างกว่าจอ (ตั้ง minWidth ใน fixedTableSx) เลื่อนแนวนอนในกรอบของตัวเอง ไม่ดันทั้งหน้า:
    // flex item ค่าเริ่มต้น min-width: auto จะขยายตามตาราง จึงตั้ง 0 ตลอดสายจากเนื้อหาถึงการ์ดรายการ
    // (react-admin ตั้ง root เป็น min-width: fit-content ไว้ — ทำให้ทั้งหน้ากว้างตามตาราง)
    RaLayout: { styleOverrides: { root: { minWidth: 0, "& .RaLayout-appFrame, & .RaLayout-contentWithSidebar, & .RaLayout-content": { minWidth: 0 } } } },
    RaList: { styleOverrides: { root: { minWidth: 0, "& .RaList-main, & .RaList-content": { minWidth: 0 } } } },
    RaDataTable: {
      styleOverrides: {
        root: {
          "& .RaDataTable-tableWrapper": { maxHeight: "calc(100vh - 200px)", overflowY: "auto", scrollbarWidth: "thin" },
          // หัวที่ลอยอยู่ใช้พื้นทึบ + เส้นล่างแบบเงา (เส้นขอบปกติของเซลล์ sticky หายตอนเลื่อน)
          "& .RaDataTable-headerCell": { backgroundColor: C.head, boxShadow: `inset 0 -1px 0 ${C.line}`, zIndex: 3 },
        },
      },
    },
    RaBulkActionsToolbar: {
      styleOverrides: {
        root: {
          "& .RaBulkActionsToolbar-toolbar": { backgroundColor: C.brandSoft, color: C.brand, borderRadius: "10px 10px 0 0" },
        },
      },
    },

    // ---------- กล่องโต้ตอบ: มุมมน ฉากหลังเบลอเล็กน้อย ----------
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, border: `1px solid ${C.line}`, boxShadow: "0 20px 48px -12px rgba(15, 23, 42, 0.25)" },
      },
    },
    MuiBackdrop: {
      styleOverrides: { root: { "&:not(.MuiBackdrop-invisible)": { backgroundColor: "rgba(15, 23, 42, 0.32)", backdropFilter: "blur(2px)" } } },
    },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 10, border: `1px solid ${C.line}`, boxShadow: "0 12px 32px -8px rgba(15, 23, 42, 0.18)" } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: C.ink, fontSize: "0.75rem", borderRadius: 6 } } },
    MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 10 } } },

    // ---------- เมนูด้านซ้าย ----------
    // ย่อ/ขยาย (ปุ่ม ☰): 300ms ease-in-out ทั้งกรอบเมนูและแถบเมนู, ข้อความไม่ขึ้นบรรทัดใหม่ และค่อยๆ จางหายตอนย่อ (ไอคอนยังอยู่)
    RaSidebar: {
      styleOverrides: {
        root: {
          "& .MuiPaper-root": { border: "none", transition: `width ${MOTION.sidebar}ms ${MOTION.easeInOut}` },
        },
      },
    },
    RaMenu: {
      styleOverrides: {
        root: {
          paddingTop: 8,
          transition: `width ${MOTION.sidebar}ms ${MOTION.easeInOut}`,
          // ---- ขนาดของรายการเมนู (ต้องสอดคล้องกัน) ----
          // เมนูย่อกว้าง 56px (theme.sidebar.closedWidth) · กล่องไอคอนกว้าง 40px คงที่ (= ค่าเดิมของ react-admin) จัดไอคอนไว้กลางกล่อง
          // ย่อ: ขอบซ้ายขวา (56 − 40) / 2 = 8 และไม่มีระยะใน → รายการ 40×40 = กล่องไอคอนพอดี → กรอบสีสมมาตรรอบไอคอน
          // ขยาย: ระยะในซ้าย 4 → ไอคอนอยู่ห่างขอบรายการ 4 + 8 = 12px
          // ทุกค่าที่เปลี่ยนตอนย่อ/ขยาย (ระยะขอบ ระยะใน ขนาดข้อความ) ไหลต่อเนื่องพร้อมความกว้างเมนู — ไม่มีค่าที่กระโดด
          // (ใช้ class ซ้ำสองครั้งเพื่อให้ชนะสไตล์ของ MUI MenuItem / react-admin MenuItemLink แน่นอน)
          "& .MuiMenuItem-root.MuiMenuItem-root": {
            margin: "2px 8px",
            padding: "0 12px 0 4px",
            // สูง 40 เท่ากันทั้งตอนขยายและย่อ (ไม่กระโดดตอนเปลี่ยน) · ไอคอน/ข้อความอยู่กึ่งกลางแนวตั้ง
            height: 40,
            minHeight: 40,
            alignItems: "center",
            borderRadius: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            color: C.ink2,
            transition: [
              ease("background-color, color", MOTION.fast),
              `margin ${MOTION.sidebar}ms ${MOTION.easeInOut}`,
              `padding ${MOTION.sidebar}ms ${MOTION.easeInOut}`,
              `font-size ${MOTION.sidebar}ms ${MOTION.easeInOut}`,
            ].join(", "),
            "&:hover": { backgroundColor: C.hover, color: C.ink },
          },
          "& .MuiListItemIcon-root.MuiListItemIcon-root": {
            color: "inherit",
            width: 40,
            minWidth: 40,
            justifyContent: "center",
            transition: ease("color"),
          },
          // เมนูที่เลือกอยู่: พื้นสีอ่อน + ตัวอักษร/ไอคอนสีแบรนด์ตัวหนา (ไม่มีแถบเส้น)
          "& .RaMenuItemLink-active.RaMenuItemLink-active": {
            backgroundColor: C.brandSelected,
            color: C.brand,
            fontWeight: 600,
            "&:hover": { backgroundColor: C.brandSelected },
          },
          // ย่อแล้ว: ข้อความจางหายและหดเป็น 0 (ไอคอนใช้ขนาด rem จึงไม่หดตาม) เหลือกล่องไอคอน 40px เต็มรายการ
          // กรอบเป็นสี่เหลี่ยมจัตุรัส 40×40 (MUI เว้นบนล่าง 6px แต่ซ้ายขวาเหลือ 8px → กรอบเตี้ยกว่ากว้าง ระยะรอบไอคอนไม่เท่ากัน)
          "&.RaMenu-closed .MuiMenuItem-root.MuiMenuItem-root": {
            color: "transparent",
            fontSize: 0,
            margin: "2px 8px",
            padding: 0,
            height: 40,
            minHeight: 40,
          },
          "&.RaMenu-closed .MuiListItemIcon-root.MuiListItemIcon-root": { color: C.ink2 },
          "&.RaMenu-closed .RaMenuItemLink-active .MuiListItemIcon-root.MuiListItemIcon-root": { color: C.brand },
        },
      },
    },
  },
};

/**
 * คั่นกลุ่มเมนู (ผู้ใช้ · หน่วยงาน · Group): ระยะห่างบนล่าง 10px + เส้น 1px สีเดียวกับเส้นขอบ
 * เส้นเยื้องเข้าเท่าขอบรายการเมนู (8px) จึงยาวเท่ากรอบเมนูทั้งตอนย่อและขยาย
 */
function MenuSeparator() {
  return <Box role="separator" aria-hidden sx={{ my: "10px", mx: "8px", borderTop: `1px solid ${C.line}` }} />;
}

function AdminMenu() {
  return (
    <Menu>
      <Menu.DashboardItem primaryText="ภาพรวม" />
      <Menu.ResourceItem name="users" />
      <Menu.ResourceItem name="roles" />
      <MenuSeparator />
      <Menu.ResourceItem name="sales-units" />
      <Menu.ResourceItem name="branch-areas" />
      <Menu.ResourceItem name="operation-units" />
      <Menu.ResourceItem name="pending-units" />
      <MenuSeparator />
      <Menu.ResourceItem name="groups" />
      <Menu.ResourceItem name="pending-groups" />
      <MenuSeparator />
      {/* โซน · หน่วยงาน · ประเภท (master-data.tsx) */}
      <Menu.Item to="/database" primaryText="แก้ไขฐานข้อมูล" leftIcon={<StorageIcon />} />
      {/* Menu.Item นำทางผ่าน router ของ react-admin (hash) จึงใช้ <a> ธรรมดาเพื่อออกไปเว็บหลัก */}
      <MenuItem component="a" href={DASHBOARD_URL}>
        <ListItemIcon>
          <ArrowBackIcon fontSize="small" />
        </ListItemIcon>
        กลับไป Dashboard
      </MenuItem>
    </Menu>
  );
}

/** แถบบน: ชื่อหน้า · ตัวเลือกฐานข้อมูลปี (เฉพาะหน้าที่แยกตามปี) · ปุ่มรีเฟรช/ผู้ใช้ของ react-admin */
function AdminAppBar() {
  return (
    <AppBar>
      {/* ชื่อหน้ากว้างคงที่ — ตัวเลือกปีถัดไปจึงอยู่ตำแหน่งเดิมทุกหน้า ไม่ขยับตามความยาวชื่อหน้า (ยาวเกินตัด …) */}
      <TitlePortal
        sx={{
          flex: "0 0 auto",
          width: { xs: 140, sm: 260, md: 300 },
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      />
      <YearBar />
      <Box sx={{ flex: 1 }} />
    </AppBar>
  );
}

export function AdminLayout({ children }: LayoutProps) {
  // appBarAlwaysOn: แถบบนค้างอยู่ตลอด ไม่ซ่อนตอนเลื่อนลง (ค่าเริ่มต้นของ react-admin ซ่อน)
  // YearProvider ครอบทั้ง Layout: โหลดรายการปีก่อนแสดงหน้า และแถบบนใช้ตัวเลือกปีได้ — ทุกคำขอแนบปีที่เลือก (year.tsx)
  return (
    <YearProvider>
      <Layout menu={AdminMenu} appBar={AdminAppBar} appBarAlwaysOn>
        {children}
      </Layout>
    </YearProvider>
  );
}
