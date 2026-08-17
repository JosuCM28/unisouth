"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_RANGE_DAYS,
  RANGE_OPTIONS,
} from "@/lib/constants/report-ranges";
import { cn } from "@/lib/utils";

export function RangeTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = Number(searchParams.get("dias")) || DEFAULT_RANGE_DAYS;

  function select(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dias", String(days));
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Periodo del reporte">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.days}
          type="button"
          onClick={() => select(option.days)}
          aria-pressed={current === option.days}
          className={cn(
            "touch-target flex-1 rounded border px-3 text-sm transition-colors sm:flex-none",
            current === option.days
              ? "border-primary bg-primary font-medium text-primary-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
