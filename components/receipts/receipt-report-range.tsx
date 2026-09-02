"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIOD_GROUPS, type PeriodGroup } from "@/lib/constants/receipt-report";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface ReceiptReportRangeProps {
  /** El rango EFECTIVO, ya resuelto en el servidor. */
  fromInput: string;
  toInput: string;
  group: PeriodGroup;
}

/**
 * El rango del reporte y cómo se corta.
 *
 * Recibe el rango ya resuelto en vez de leerlo de la URL: con la URL vacía
 * —que es como se entra la primera vez— los campos saldrían en blanco aunque
 * el reporte de abajo sí esté mostrando el año corrido, y quien lo mira no
 * tendría cómo saber qué periodo está leyendo.
 *
 * Escribe a la URL como los demás filtros: así el botón de Excel arrastra el
 * mismo rango y el archivo corresponde a lo que se está viendo.
 */
export function ReceiptReportRange({
  fromInput,
  toInput,
  group,
}: ReceiptReportRangeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 border border-border p-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-1 flex-wrap items-end gap-3">
        <Field label="Desde">
          <Input
            type="date"
            value={fromInput}
            max={toInput}
            onChange={(event) => setParam("desde", event.target.value)}
            className="touch-target tabular w-full"
          />
        </Field>

        <Field label="Hasta">
          <Input
            type="date"
            value={toInput}
            min={fromInput}
            onChange={(event) => setParam("hasta", event.target.value)}
            className="touch-target tabular w-full"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Agrupar por</span>

        <div className="flex gap-2" role="group" aria-label="Agrupación del reporte">
          {PERIOD_GROUPS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setParam("agrupar", option.key)}
              aria-pressed={group === option.key}
              className={cn(
                "touch-target flex-1 rounded border px-3 text-sm transition-colors md:flex-none",
                group === option.key
                  ? "border-primary bg-primary font-medium text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-36 flex-1 flex-col gap-1 md:max-w-44">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
