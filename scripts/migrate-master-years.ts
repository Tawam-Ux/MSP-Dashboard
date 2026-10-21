// ย้ายตารางข้อมูลหลักเป็นแบบแยกปี (คอลัมน์ year เป็นส่วนหนึ่งของ primary key) — รันซ้ำได้ ตารางที่มีคอลัมน์ year แล้วข้าม
// ข้อมูลหลักชุดเดิม (ชุดเดียวใช้ทุกปี) ถูกคัดลอกให้ทุกปีที่มีข้อมูลใน group_amounts / ไฟล์ที่ใช้อยู่ (ไม่มีข้อมูลเลย = ปีปัจจุบัน)
// ก่อนแก้ สำรองทุกแถวของตารางที่จะแก้เป็น JSON ไว้ที่ storage/backups/
// รันเองได้: npx tsx scripts/migrate-master-years.ts · npm start รันให้ก่อน drizzle-kit push ทุกครั้ง
// drizzle-kit push เพิ่มคอลัมน์ NOT NULL ให้ตารางที่มีข้อมูลแล้ว/เปลี่ยน primary key เองไม่ได้ จึงต้องมีสคริปต์นี้
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db, pool } from "@/backend/db";

type Table = {
  name: string;
  /** primary key เดิม (ไม่รวม year) */
  key: string[];
  /** index ที่ต้องมี year นำหน้า: ชื่อ → [unique, คอลัมน์เดิม] */
  indexes?: Record<string, [boolean, string[]]>;
};

const TABLES: Table[] = [
  { name: "units", key: ["code"], indexes: { units_parent_idx: [false, ["parent_code"]] } },
  { name: "unit_closure", key: ["ancestor", "descendant"], indexes: { closure_descendant_idx: [false, ["descendant"]] } },
  { name: "zones", key: ["code"], indexes: { zones_key_idx: [true, ["key"]] } },
  { name: "unit_categories", key: ["code"], indexes: { unit_categories_prefix_idx: [true, ["prefix"]] } },
  { name: "organizations", key: ["code"] },
  { name: "detected_units", key: ["code"] },
  { name: "unit_overrides", key: ["code"] },
  { name: "detected_groups", key: ["code"] },
  { name: "group_names", key: ["code"] },
  { name: "branch_areas", key: ["unit_code"] },
];

const q = async <T = Record<string, unknown>>(query: string): Promise<T[]> => ((await db.execute(sql.raw(query))) as unknown as [T[]])[0];
const id = (s: string) => `\`${s}\``;

async function main() {
  const existing = new Set((await q<{ t: string }>("select table_name t from information_schema.tables where table_schema = database()")).map((r) => r.t));
  const withYear = new Set(
    (await q<{ t: string }>("select table_name t from information_schema.columns where table_schema = database() and column_name = 'year'")).map((r) => r.t),
  );
  const todo = TABLES.filter((t) => existing.has(t.name) && !withYear.has(t.name));
  if (todo.length === 0) return console.log("[migrate] ข้อมูลหลักแยกปีอยู่แล้ว");

  const years = (await q<{ y: number }>(
    `select distinct y from (
       select year(period) y from group_amounts
       union select year(period) y from upload_logs where status = 'active'
     ) t where y is not null order by y`,
  )).map((r) => Number(r.y));
  if (years.length === 0) years.push(new Date().getFullYear());
  const [first, ...others] = years;
  console.log(`[migrate] แยกข้อมูลหลักตามปี: ${todo.map((t) => t.name).join(", ")} → ปี ${years.map((y) => y + 543).join(", ")}`);

  // สำรองก่อนแก้
  const backup: Record<string, unknown[]> = {};
  for (const t of todo) backup[t.name] = await q(`select * from ${id(t.name)}`);
  const dir = path.join(process.cwd(), "storage", "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `master-before-years-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 1));
  console.log(`[migrate] สำรองข้อมูลเดิมไว้ที่ ${path.relative(process.cwd(), file)}`);

  for (const t of todo) {
    const cols = (await q<{ c: string }>(
      `select column_name c from information_schema.columns where table_schema = database() and table_name = '${t.name}' order by ordinal_position`,
    )).map((r) => r.c);
    const alter = [
      `add column ${id("year")} smallint not null default ${first} first`,
      "drop primary key",
      `add primary key (${["year", ...t.key].map(id).join(", ")})`,
      ...Object.entries(t.indexes ?? {}).flatMap(([name, [unique, on]]) => [
        `drop index ${id(name)}`,
        `add ${unique ? "unique " : ""}index ${id(name)} (${["year", ...on].map(id).join(", ")})`,
      ]),
    ];
    await q(`alter table ${id(t.name)} ${alter.join(", ")}`);
    for (const y of others) {
      await q(`insert into ${id(t.name)} (${["year", ...cols].map(id).join(", ")}) select ${y}, ${cols.map(id).join(", ")} from ${id(t.name)} where ${id("year")} = ${first}`);
    }
    await q(`alter table ${id(t.name)} alter column ${id("year")} drop default`);
    console.log(`[migrate] ${t.name}: ${backup[t.name].length} แถว × ${years.length} ปี`);
  }
}

main()
  .catch((e) => {
    console.error("[migrate] ไม่สำเร็จ:", e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
