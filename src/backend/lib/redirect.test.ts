import { describe, expect, it } from "vitest";
import { adminAppOrigin, safeCallbackUrl } from "./redirect";

const admin = "http://localhost:5173";

describe("safeCallbackUrl", () => {
  it("อนุญาต path ภายในเว็บ", () => {
    expect(safeCallbackUrl("/pnl?unit=MSP", admin)).toBe("/pnl?unit=MSP");
  });

  it("อนุญาต URL ของแอปหลังบ้าน", () => {
    expect(safeCallbackUrl("http://localhost:5173/#/users", admin)).toBe("http://localhost:5173/#/users");
  });

  it("ไม่อนุญาตเว็บอื่นหรือรูปแบบที่เบราว์เซอร์ตีความเป็นโดเมนอื่น", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "http://localhost:5174/", "javascript:alert(1)"]) {
      expect(safeCallbackUrl(bad, admin)).toBe("/");
    }
  });

  it("ไม่ได้ตั้งแอปหลังบ้าน = รับเฉพาะ path ภายใน", () => {
    expect(safeCallbackUrl("http://localhost:5173/", null)).toBe("/");
  });

  it("ค่าว่างหรือไม่ใช่ข้อความ = หน้าแรก", () => {
    expect(safeCallbackUrl(undefined, admin)).toBe("/");
    expect(safeCallbackUrl(["/a"], admin)).toBe("/");
  });
});

describe("adminAppOrigin", () => {
  it("ตัดเหลือ origin และไม่รับค่าที่ไม่ใช่ URL", () => {
    expect(adminAppOrigin("http://localhost:5173/admin/")).toBe(admin);
    expect(adminAppOrigin("not a url")).toBeNull();
    expect(adminAppOrigin(undefined)).toBeNull();
  });
});
