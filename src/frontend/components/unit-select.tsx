"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function UnitSelect({ units, value }: { units: { code: string; name: string; level: number }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const minLevel = Math.min(...units.map((u) => u.level));

  return (
    <label className="flex items-center text-sm">
      <span className="sr-only">หน่วย</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("unit", e.target.value);
          router.push(`${pathname}?${next}`);
        }}
        className="select max-w-[18rem]"
      >
        {units.map((u) => (
          <option key={u.code} value={u.code}>
            {"  ".repeat(u.level - minLevel)}
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}
