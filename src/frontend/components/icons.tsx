// ไอคอนเส้น 24×24 ชุดเดียวทั้งระบบ (stroke เท่ากัน ปลายมน) — ใช้แทนอักขระ ▲▼✓!← ที่หน้าตาต่างกันไปตามฟอนต์
const PATHS = {
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 8v5M12 16.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  back: "M15 6l-6 6 6 6",
  close: "M6 6l12 12M18 6L6 18",
  flat: "M5 12h14",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className = "", stroke = 2 }: { name: IconName; size?: number; className?: string; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
