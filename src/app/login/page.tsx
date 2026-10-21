import { redirect } from "next/navigation";
import { safeCallbackUrl } from "@/backend/lib/redirect";
import { getCurrentUser } from "@/backend/lib/session";
import { LampLogin } from "./lamp-login";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // ?callbackUrl= ส่งมาจากแอปหลังบ้านหรือหน้าที่ต้องล็อกอินก่อน
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);
  if (await getCurrentUser()) redirect(callbackUrl);

  // ห้องมืดกับโคมไฟแขวน: ดึงสายเปิดไฟ แล้วการ์ดเข้าสู่ระบบจึงปรากฏในลำแสง
  return <LampLogin callbackUrl={callbackUrl} />;
}
