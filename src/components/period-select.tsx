"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatPeriod } from "@/lib/format";

export function PeriodSelect({ periods, value }: { periods: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-2">งวด</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("period", e.target.value);
          router.push(`${pathname}?${next}`);
        }}
        className="rounded-md border border-line-strong bg-surface px-2 py-1.5 text-ink"
      >
        {periods.map((p) => (
          <option key={p} value={p}>
            {formatPeriod(p)}
          </option>
        ))}
      </select>
    </label>
  );
}
