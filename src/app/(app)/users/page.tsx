import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, units, userRoles, users, userUnitScopes } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { setUserActive } from "./actions";
import { CreateUserForm } from "./create-user-form";

export default async function UsersPage() {
  const me = await requirePermission("users.manage");

  const [userRows, roleRows, unitRows, roleLinks, scopeLinks] = await Promise.all([
    db.select().from(users).orderBy(asc(users.username)),
    db.select().from(roles).orderBy(asc(roles.id)),
    db.select().from(units).orderBy(asc(units.level), asc(units.sortOrder)),
    db.select({ userId: userRoles.userId, name: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)),
    db.select().from(userUnitScopes),
  ]);

  const unitName = new Map(unitRows.map((u) => [u.code, u.name]));
  // เรียงหน่วยเป็นต้นไม้: แม่ตามด้วยลูก
  const tree: typeof unitRows = [];
  const visit = (parent: string | null) => {
    for (const u of unitRows.filter((x) => x.parentCode === parent).sort((a, b) => a.sortOrder - b.sortOrder)) {
      tree.push(u);
      visit(u.code);
    }
  };
  visit(null);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="font-display text-3xl font-semibold">ผู้ใช้และสิทธิ์</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          บทบาทกำหนดว่าทำอะไรได้ หน่วยกำหนดว่าเห็นข้อมูลส่วนไหน ให้สิทธิ์หน่วยแม่จะเห็นสาขาย่อยทั้งหมดของหน่วยนั้น
        </p>
        <table className="mt-6 w-full max-w-5xl text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="py-2 font-normal">ผู้ใช้</th>
              <th className="py-2 font-normal">บทบาท</th>
              <th className="py-2 font-normal">เห็นข้อมูลของ</th>
              <th className="py-2 font-normal">สถานะ</th>
              <th className="py-2"><span className="sr-only">จัดการ</span></th>
            </tr>
          </thead>
          <tbody>
            {userRows.map((u) => (
              <tr key={u.id} className="border-b border-line align-top last:border-0">
                <td className="py-2.5">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-ink-3">{u.username}{u.authProvider !== "local" && ` (${u.authProvider})`}</div>
                </td>
                <td className="py-2.5">{roleLinks.filter((r) => r.userId === u.id).map((r) => r.name).join(", ") || "—"}</td>
                <td className="py-2.5 text-ink-2">
                  {scopeLinks.filter((s) => s.userId === u.id).map((s) => unitName.get(s.unitCode) ?? s.unitCode).join(", ") || "—"}
                </td>
                <td className="py-2.5">{u.isActive ? "ใช้งาน" : <span className="text-ink-3">ปิดใช้งาน</span>}</td>
                <td className="py-2.5 text-right">
                  {u.id !== me.id && (
                    <form action={setUserActive}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="active" value={u.isActive ? "0" : "1"} />
                      <button type="submit" className="rounded-md px-2 py-1 text-ink-2 hover:bg-surface hover:text-ink">
                        {u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">เพิ่มผู้ใช้</h2>
        {unitRows.length === 0 ? (
          <p className="mt-2 text-ink-2">นำเข้าข้อมูลอย่างน้อย 1 งวดก่อน เพื่อให้มีรายชื่อหน่วยให้เลือก</p>
        ) : (
          <div className="mt-4">
            <CreateUserForm
              roles={roleRows.map((r) => ({ code: r.code, name: r.name }))}
              units={tree.map((u) => ({ code: u.code, name: u.name, level: u.level }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
