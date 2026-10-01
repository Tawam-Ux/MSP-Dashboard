# MSP Dashboard

Dashboard งบกำไรขาดทุนรายเดือนของ MSP จากไฟล์ Excel รันบนเครื่อง local
รายละเอียดการออกแบบอยู่ใน [docs/spec.md](docs/spec.md)

## ติดตั้งครั้งแรก

1. ติดตั้ง **MySQL Server 8.4** และ **MySQL Workbench** จาก MySQL Installer for Windows
2. สร้างฐานข้อมูล (ใน Workbench หรือ `mysql -u root -p`):
   ```sql
   CREATE DATABASE msp_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   ```
3. คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่า:
   - `DATABASE_URL` ใส่รหัสผ่าน root ของ MySQL
   - `AUTH_SECRET` สร้างด้วย `npx auth secret` (หรือสุ่มข้อความยาวๆ)
   - `ADMIN_PASSWORD` รหัสผ่านของบัญชี `admin`
4. ติดตั้งและเตรียมฐานข้อมูล:
   ```powershell
   npm install
   npm run db:push     # สร้างตาราง
   npm run db:seed     # สร้าง role, permission, ผังบัญชี, บัญชี admin
   npm run import -- Data.xlsx 2026   # นำเข้าไฟล์ตัวอย่าง (ปี ค.ศ.)
   ```
5. เปิดระบบ:
   ```powershell
   npm run dev                       # ระหว่างพัฒนา
   npm run build; npm start          # ใช้งานจริง
   ```
   แล้วเข้า http://localhost:3000 ด้วยชื่อผู้ใช้ `admin`

## นำเข้าเดือนใหม่

เข้าเมนู **นำเข้าข้อมูล** เลือกไฟล์และปี พ.ศ. กด **ตรวจไฟล์** เพื่อดูสรุปก่อน แล้วกด **นำเข้าข้อมูล**
ถ้านำเข้างวดเดิมซ้ำ ข้อมูลเก่าของงวดนั้นจะถูกแทนที่ทั้งหมด

ถ้าไฟล์มีรหัสบัญชีใหม่ ระบบจะไม่ยอมนำเข้า ต้องเพิ่มบัญชีใน `src/lib/statement.ts` ก่อน

## ระบบสิทธิ์

- **บทบาท** กำหนดว่าทำอะไรได้: admin, executive, accountant, branch_manager (`src/lib/authz/scope.ts`)
- **หน่วย** กำหนดว่าเห็นข้อมูลส่วนไหน ให้สิทธิ์หน่วยแม่จะเห็นสาขาย่อยทั้งหมด
- ข้อมูลการเงินทุกจุดดึงผ่าน `src/lib/reports.ts` ซึ่งกรองตามหน่วยที่ผู้ใช้มีสิทธิ์
- เมื่อเชื่อมเว็บหลัก: เพิ่ม provider ใน `src/auth.ts` แล้วจับคู่ผู้ใช้ด้วย `users.auth_provider` + `users.external_id`

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | รัน test (ตัวแปลงไฟล์ใช้ `Data.xlsx` ถ้ามี) |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm run lint` | ตรวจโค้ดด้วย ESLint |
