import type { Metadata } from "next";
import { Bai_Jamjuree, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const display = Bai_Jamjuree({ variable: "--font-display", subsets: ["thai", "latin"], weight: ["500", "600", "700"] });
const body = IBM_Plex_Sans_Thai({ variable: "--font-body", subsets: ["thai", "latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "MSP งบกำไรขาดทุน",
  description: "Dashboard งบกำไรขาดทุนรายเดือนของ MSP แยกตามหน่วยธุรกิจและสาขา",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
