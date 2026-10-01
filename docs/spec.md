# MSP Dashboard — Spec

## เป้าหมาย
Dashboard งบกำไรขาดทุนของ MSP จากไฟล์ Excel รายเดือน (`Data.xlsx`) รันบนเครื่อง local
พร้อมระบบสิทธิ์มาตรฐานที่พร้อมเชื่อมกับเว็บหลักในอนาคต

## Stack
- Next.js (App Router) + TypeScript, Tailwind CSS
- MySQL 8.4 (local, Windows Service), Drizzle ORM + mysql2
- Auth.js (Credentials ตอนนี้; OIDC/JWT จากเว็บหลักในอนาคต)
- exceljs (อ่าน Excel), กราฟเขียนด้วย HTML/CSS (เพิ่ม ECharts เมื่อมีกราฟแนวโน้มหลายเดือน)
- Vitest (ทดสอบ)

## รูปแบบไฟล์ Excel ที่รองรับ
- ชีตงบรวมชื่อ `<เดือน>` (เช่น `ม.ค.`) และชีตสาขา `<ภูมิภาค>_<เดือน>`
- แถว 1: `A1 = MASTER_`, `B1 = ชื่อเดือนไทยย่อ`, จากคอลัมน์ C ทุก 3 คอลัมน์คือรหัสหน่วย
- แถว 2: ชื่อหน่วย (คอลัมน์ C, F, I, ...) คอลัมน์ถัดไปเป็น `%` และคอลัมน์ว่าง
- แถว 3+: คอลัมน์ A = รหัสบัญชี, B = ชื่อรายการ; แถวที่ไม่มีรหัสบัญชีคือยอดรวม → ไม่นำเข้า
- คอลัมน์ C ของทุกชีต = ยอดรวมของชีตนั้น (หน่วยแม่)

## ข้อมูล
- `units(code, name, parent_code, level, sort_order)` — บริษัท(MSP) → หน่วยธุรกิจ → สาขา
- `accounts(code, name, section, sort_order)`
- `facts(period DATE, unit_code, account_code, amount DECIMAL(18,2))` unique `(period, unit_code, account_code)`
- อัปโหลดงวดเดิมซ้ำ = ลบข้อมูลงวดนั้นแล้วใส่ใหม่ใน transaction เดียว (หน่วยที่หายไปจากไฟล์จะไม่ค้าง)
- ยอดรวมคำนวณจาก facts ไม่เก็บซ้ำ

## สิทธิ์
- RBAC: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
- Data scope: `user_unit_scopes` + `unit_closure` (สืบทอดลงลำดับชั้น)
- ทุก query ข้อมูลการเงินอยู่ใน `src/lib/reports.ts` และกรองด้วย `user.allowedUnits` (คำนวณใน `src/lib/session.ts`)
- Roles เริ่มต้น: admin, executive, accountant, branch_manager
- Permissions: `dashboard.view`, `report.export`, `data.upload`, `users.manage`
- `users.auth_provider`, `users.external_id` เตรียมไว้สำหรับ SSO
- `upload_logs` บันทึกการอัปโหลด

## หน้าจอ v1
1. Login
2. Dashboard: ตัวเลขหลัก (รายได้รวม, กำไรขั้นต้น/%, กำไรก่อนภาษี), แถบ "จากรายได้ทุก 100 บาท", อันดับหน่วย, drill-down เข้าสาขา, ตารางงบกำไรขาดทุน
3. อัปโหลด Excel (ต้องมี `data.upload`) — ตรวจและแสดงผลก่อนยืนยัน
4. จัดการผู้ใช้ (ต้องมี `users.manage`)

## ข้อมูลที่ต้องระวัง
- ชื่อสาขา "เอ็มพีจอมทอง" ซ้ำ 2 คอลัมน์ แต่รหัสต่างกัน (CM-152, CM-167) — ใช้รหัสหน่วยจากแถว 1 เป็น key
- ชีตสุโขทัย คอลัมน์ "รวมสาขา" ใส่รหัส SU-HO ซ้ำกับออฟฟิศ — คอลัมน์ที่ชื่อขึ้นต้นด้วย "รวม" ถือเป็นยอดรวมย่อย ไม่นำเข้า
- แถวปันส่วน HQ (3 แถวท้าย) มีเฉพาะในชีตภูมิภาค งบรวมเป็น 0 — นำเข้าแต่ไม่นำไปคิดยอดรวม จนกว่าจะยืนยันเครื่องหมาย
- ปีไม่อยู่ในไฟล์ — ผู้อัปโหลดระบุปี พ.ศ. เอง
- ค่าทศนิยมลอย → ปัดเป็น 2 ตำแหน่งตอนนำเข้า
