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
   ```
5. เปิดระบบ:
   ```powershell
   npm start                         # ระหว่างพัฒนา: เปิดเบราว์เซอร์ให้อัตโนมัติ + แก้โค้ดแล้วเว็บอัปเดตเอง (NO_OPEN=1 เพื่อไม่เปิดเบราว์เซอร์)
   npm run build; npm run start:prod # ใช้งานจริง
   ```
   แล้วเข้า http://localhost:3000 ด้วยชื่อผู้ใช้ `admin`

## นำเข้าไฟล์ Master

ระบบใช้ **ไฟล์ Master ปีละไฟล์** เป็นข้อมูลของ Dashboard (หลายปีอยู่ร่วมกันได้ · นำเข้าไฟล์ปีเดิมซ้ำ = แทนข้อมูลปีนั้น) อ่านเฉพาะชีตงบที่แท็บสี `#002060` (`ม.ค.`, `เชียงใหม่_ม.ค.`, …)
ดึงยอดราย Group ของแต่ละสาขา แล้วคำนวณงบของทุกหน่วยที่ backend ตาม Flow (รายละเอียดใน [docs/spec.md](docs/spec.md))

เข้าเมนู **นำเข้าข้อมูล** ลากไฟล์มาวาง ระบบจะแสดงยอดรวมรายเดือนที่คำนวณได้ (และแจ้งถ้าไม่ตรงกับยอดรวมในไฟล์) ใส่ปี พ.ศ. แล้วกด **ยืนยันนำเข้า**
หรือใช้ command line: `npm run import -- <ไฟล์.xlsx> <ปี ค.ศ.>`

- ข้อมูลเดิมทั้งหมดถูกแทนด้วยไฟล์ใหม่ทันที
- ไฟล์ Master เดิมถูกย้ายไปเก็บที่โฟลเดอร์ backup บน Google Drive
- ถ้าส่งขึ้น Drive ไม่สำเร็จ (ไม่มีเน็ต/ยังไม่ได้ตั้งค่า) ไฟล์เดิมจะรออยู่ในเครื่องที่ `storage/masters` สถานะ "รอ backup"
  กด **ส่งขึ้น Drive อีกครั้ง** ในประวัติการนำเข้าได้ภายหลัง — Dashboard ใช้ไฟล์ใหม่ตามปกติระหว่างนั้น

## ตั้งค่า Google Drive (Gmail ส่วนตัว) — ทำครั้งเดียว

1. เข้า [Google Cloud Console](https://console.cloud.google.com/) สร้างโปรเจกต์ใหม่ (ชื่ออะไรก็ได้)
2. **APIs & Services → Library** ค้นหา **Google Drive API** แล้วกด **Enable**
3. **APIs & Services → OAuth consent screen**
   - User type: **External** · ใส่ชื่อแอปและอีเมลติดต่อ · Scopes ไม่ต้องเพิ่ม
   - **Audience / Publishing status** กด **Publish app** ให้เป็น *In production*
     (ถ้าค้างไว้ที่ *Testing* สิทธิ์จะหมดอายุทุก 7 วันและ backup จะเริ่มล้มเหลว)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** เลือกประเภท **Desktop app**
   แล้วคัดลอก Client ID และ Client secret ใส่ใน `.env`:
   ```
   GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="..."
   ```
5. รัน `npm run drive:auth` → เบราว์เซอร์จะเปิดให้ล็อกอิน Gmail ที่จะเก็บไฟล์
   (ถ้าขึ้นว่า "Google hasn't verified this app" กด **Advanced → Go to ...** ได้ เพราะเป็นแอปของเราเอง)
6. สคริปต์จะสร้างโฟลเดอร์ **MSP Dashboard - Master Backup** ใน My Drive และเติม `GOOGLE_REFRESH_TOKEN`,
   `GOOGLE_DRIVE_BACKUP_FOLDER_ID` ลง `.env` ให้เอง แล้วรีสตาร์ต `npm start`

ระบบขอสิทธิ์แค่ `drive.file` คือเห็นได้เฉพาะไฟล์ที่ระบบสร้างเอง ไม่เห็นไฟล์อื่นใน Drive

## ระบบสิทธิ์

- **บทบาท** กำหนดว่าทำอะไรได้: admin, executive, accountant, branch_manager (`src/backend/lib/authz/scope.ts`)
- **หน่วย** กำหนดว่าเห็นข้อมูลส่วนไหน ให้สิทธิ์หน่วยแม่จะเห็นสาขาย่อยทั้งหมด
- ข้อมูลการเงินทุกจุดดึงผ่าน `src/backend/lib/reports.ts` ซึ่งกรองตามหน่วยที่ผู้ใช้มีสิทธิ์
- เมื่อเชื่อมเว็บหลัก: เพิ่ม provider ใน `src/backend/auth.ts` แล้วจับคู่ผู้ใช้ด้วย `users.auth_provider` + `users.external_id`

## แอปหลังบ้าน (admin-app/)

จัดการผู้ใช้ ดูบทบาทและผังหน่วยงาน (ผังหน่วยกำหนดในโค้ด `src/backend/lib/master-import/units.ts` — แก้แล้วรัน `npm run db:seed`) ด้วย react-admin แยกเป็นแอป Vite ของตัวเอง เรียก API `/api/admin/*` ของเว็บนี้
(ต้องมีสิทธิ์ `users.manage`) และใช้การล็อกอินร่วมกับเว็บนี้ — ไม่มีหน้า login แยก

1. ใน `.env` ของเว็บนี้ ตั้ง `ADMIN_APP_URL="http://localhost:5173"` (แสดงเมนู Admin และอนุญาตให้ส่งกลับหลังล็อกอิน)
2. ติดตั้งครั้งแรก: `cd admin-app` แล้ว `npm install`
3. `npm start` ที่โฟลเดอร์หลักจะเปิดทั้งเว็บนี้และแอปหลังบ้าน (log ขึ้นต้นด้วย `[admin]`)
   แล้วเข้า http://localhost:5173 — ถ้ายังไม่ล็อกอินจะถูกส่งไปหน้า login ของเว็บนี้ แล้วกลับมาเอง
   ไม่ต้องการเปิดแอปหลังบ้าน: ตั้ง `NO_ADMIN=1` · รันแยกเอง: `cd admin-app` แล้ว `npm run dev`

แอปนี้เรียก `/api` ผ่าน proxy (ดู `admin-app/vite.config.ts`) ให้ browser มองเป็นโดเมนเดียวกัน cookie ล็อกอินจึงใช้ได้โดยไม่ต้องตั้ง CORS
ตอนขึ้นระบบจริง: `npm run build` ใน `admin-app/` ได้ไฟล์ static ใน `admin-app/dist/` ให้ reverse proxy (เช่น nginx)
เสิร์ฟไฟล์เหล่านี้ และส่งต่อ `/api/` ไปที่เว็บนี้ **บนโดเมนเดียวกับเว็บหลัก** เช่น `dashboard.example.com/admin/`
(build ด้วย `VITE_BASE=/admin/`) เพราะ cookie ล็อกอินผูกกับโดเมนของเว็บหลัก

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | รัน test (เทียบผลคำนวณกับไฟล์ `PreView_ForClaude/MSP-P_Lเชียงใหม่ 2026_08.xlsx` ถ้ามี) |
| `npm run import -- <ไฟล์> <ปี ค.ศ.>` | นำเข้าไฟล์ Master จาก command line |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm run lint` | ตรวจโค้ดด้วย ESLint |
