import SearchIcon from "@mui/icons-material/Search";
import { Box, Tooltip } from "@mui/material";
import { SearchInput, useListContext } from "react-admin";

// ค้นหาเฉพาะคอลัมน์: คลิกหัวคอลัมน์เพื่อเลือก (filter.qField) คลิกซ้ำเพื่อกลับไปค้นหาทุกคอลัมน์
// API ต้องรองรับ qField (listResponse ใน src/backend/lib/admin-api.ts) และคอลัมน์ต้องอยู่ใน searchFields ของ resource นั้น

/** ช่องค้นหาที่บอกว่ากำลังค้นหาทุกคอลัมน์หรือเฉพาะคอลัมน์ที่เลือก */
export function ColumnSearchInput({ columns, allPlaceholder, ...props }: {
  columns: Record<string, string>; allPlaceholder: string; source: string; alwaysOn?: boolean;
}) {
  const { filterValues } = useListContext();
  const field = filterValues.qField as string | undefined;
  const placeholder = field && columns[field] ? `ค้นหาเฉพาะ${columns[field]}` : allPlaceholder;
  return <SearchInput {...props} placeholder={placeholder} />;
}

/** หัวคอลัมน์ที่คลิกเพื่อเลือกคอลัมน์ค้นหา — คอลัมน์ที่เลือกอยู่แสดงสีหลักพร้อมไอคอนค้นหา */
export function SearchScopeHeader({ field, label }: { field: string; label: string }) {
  const { filterValues, displayedFilters, setFilters } = useListContext();
  const active = filterValues.qField === field;
  const toggle = () => {
    const { qField: _, ...rest } = filterValues;
    setFilters(active ? rest : { ...rest, qField: field }, displayedFilters);
  };
  return (
    <Tooltip title={active ? "คลิกเพื่อกลับไปค้นหาทุกคอลัมน์" : `คลิกเพื่อค้นหาเฉพาะ${label}`}>
      <Box
        component="button"
        type="button"
        onClick={toggle}
        sx={{
          all: "unset",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          fontWeight: active ? 700 : "inherit",
          color: active ? "primary.main" : "inherit",
          "&:hover": { color: "primary.main" },
          "&:focus-visible": { outline: "2px solid", outlineOffset: 2 },
        }}
      >
        {label}
        {active && <SearchIcon sx={{ fontSize: 16 }} />}
      </Box>
    </Tooltip>
  );
}
