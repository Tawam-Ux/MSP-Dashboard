// ตรรกะสิทธิ์ที่ไม่แตะฐานข้อมูล ทดสอบได้โดยตรง

export const PERMISSIONS = {
  "dashboard.view": "ดู dashboard",
  "report.export": "ส่งออกรายงาน",
  "data.upload": "อัปโหลดไฟล์ Excel",
  "users.manage": "จัดการผู้ใช้และสิทธิ์",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLES: { code: string; name: string; permissions: Permission[] }[] = [
  { code: "admin", name: "ผู้ดูแลระบบ", permissions: ["dashboard.view", "report.export", "data.upload", "users.manage"] },
  { code: "executive", name: "ผู้บริหาร", permissions: ["dashboard.view", "report.export"] },
  { code: "accountant", name: "ฝ่ายบัญชี", permissions: ["dashboard.view", "data.upload"] },
  { code: "branch_manager", name: "ผู้จัดการหน่วย/สาขา", permissions: ["dashboard.view"] },
];

export type ClosureRow = { ancestor: string; descendant: string; depth: number };

export function buildClosure(units: { code: string; parentCode: string | null }[]): ClosureRow[] {
  const parentOf = new Map(units.map((u) => [u.code, u.parentCode]));
  const rows: ClosureRow[] = [];
  for (const u of units) {
    let current: string | null = u.code;
    let depth = 0;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current)) throw new Error(`ลำดับชั้นหน่วยวนกลับที่ "${current}"`);
      seen.add(current);
      rows.push({ ancestor: current, descendant: u.code, depth });
      current = parentOf.get(current) ?? null;
      depth++;
    }
  }
  return rows;
}

/** หน่วยทั้งหมดที่ผู้ใช้เห็นได้ = ทุกหน่วยใต้หน่วยที่ได้รับสิทธิ์ (รวมตัวเอง) */
export function resolveAllowedUnits(scopeUnits: string[], closure: ClosureRow[]): Set<string> {
  const scopes = new Set(scopeUnits);
  return new Set(closure.filter((r) => scopes.has(r.ancestor)).map((r) => r.descendant));
}

/** หน่วยเริ่มต้นของ dashboard: หน่วยที่อยู่สูงสุดในบรรดาที่เห็นได้ */
export function defaultUnit(allowed: Set<string>, closure: ClosureRow[]): string | null {
  const tops = [...allowed].filter(
    (code) => !closure.some((r) => r.descendant === code && r.depth > 0 && allowed.has(r.ancestor)),
  );
  return tops[0] ?? null;
}

export function hasPermission(user: { permissions: readonly string[] }, permission: Permission): boolean {
  return user.permissions.includes(permission);
}
