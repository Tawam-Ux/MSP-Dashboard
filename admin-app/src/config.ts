/** เว็บหลัก (Next.js) — หน้า login และลิงก์กลับ Dashboard อยู่ที่นี่ ส่วน /api เรียกผ่าน proxy ของ Vite */
export const DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL || "http://localhost:3000").replace(/\/$/, "");
