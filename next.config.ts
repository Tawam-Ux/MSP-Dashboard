import type { NextConfig } from "next";

// เปิดผ่าน tunnel/reverse proxy (เช่น VS Code Dev Tunnels) — proxy ส่ง Origin เป็น localhost:3000
// แต่ x-forwarded-host เป็นโดเมนของ tunnel ทำให้ Next.js ปฏิเสธ Server Action
// เพิ่มโดเมนอื่นได้ทาง SERVER_ACTIONS_ALLOWED_ORIGINS (คั่นด้วย ,) เช่น "dashboard.msp.co.th"
const allowedOrigins = [
  "localhost:3000",
  "*.asse.devtunnels.ms",
  "*.devtunnels.ms",
  ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.devtunnels.ms", "*.asse.devtunnels.ms"],
  experimental: {
    serverActions: {
      // ไฟล์ Excel อัปโหลดผ่าน Server Action (ค่าเริ่มต้นรับได้แค่ 1MB)
      bodySizeLimit: "50mb",
      allowedOrigins,
    },
  },
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
