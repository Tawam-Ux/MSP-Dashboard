import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const dashboard = env.VITE_DASHBOARD_URL || "http://localhost:3000";

  return {
    plugins: [react()],
    // เสิร์ฟใต้ path ย่อยได้ เช่น VITE_BASE=/admin/ เมื่ออยู่โดเมนเดียวกับเว็บหลัก
    base: env.VITE_BASE || "/",
    server: {
      port: 5173,
      strictPort: true,
      // เรียก /api ผ่าน proxy ให้ browser มองเป็นโดเมนเดียวกัน: ใช้ cookie ล็อกอินของเว็บหลักได้ ไม่ต้องตั้ง CORS
      proxy: { "/api": { target: dashboard, changeOrigin: true } },
    },
    preview: {
      port: 4173,
      proxy: { "/api": { target: dashboard, changeOrigin: true } },
    },
  };
});
