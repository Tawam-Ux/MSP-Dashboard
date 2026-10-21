import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import "./globals.css";

// Anuphan: ไทย-ละตินแบบไม่มีหัว เส้นโค้งมน ใช้ทั้งหัวข้อและเนื้อหา (variable 100–700)
const body = Anuphan({ variable: "--font-body", subsets: ["thai", "latin"] });

// ไม่ใส่ title/icon ใน metadata: หน้าแบบ dynamic ถูก stream metadata ใหม่ทุกครั้งที่เปลี่ยนหน้า
// แท็ก <title>/<link rel=icon> จึงถูกถอดแล้วใส่ใหม่ ทำให้ชื่อและไอคอนบนแท็บเบราว์เซอร์กระพริบ
// วางไว้ใน <head> ของ root layout ซึ่งไม่ถูก render ใหม่ระหว่างเปลี่ยนหน้าแทน (favicon อยู่ใน public/)
export const metadata: Metadata = {
  description: "Dashboard งบกำไรขาดทุนรายเดือนของ MSP แยกตามหน่วยธุรกิจและสาขา",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${body.variable} h-full antialiased`}>
      <head>
        <title>MSP งบกำไรขาดทุน</title>
        <link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
