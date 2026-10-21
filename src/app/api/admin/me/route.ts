import { apiError } from "@/backend/lib/admin-api";
import { getCurrentUser } from "@/backend/lib/session";

// authProvider ของ react-admin ใช้ตรวจว่ายังล็อกอินอยู่ และโหลดสิทธิ์ไปซ่อน/แสดงเมนู
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "กรุณาเข้าสู่ระบบ");
  return Response.json({ id: user.id, fullName: user.name, username: user.username, permissions: user.permissions });
}
