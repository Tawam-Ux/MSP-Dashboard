import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ไฟล์ Excel อัปโหลดผ่าน Server Action (ค่าเริ่มต้นรับได้แค่ 1MB)
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
