"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReportMonthOption, ReportPeriod } from "@/lib/report-period";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PickerMode = ReportPeriod["kind"];

const MODES: Array<{ mode: PickerMode; label: string }> = [
  { mode: "month", label: "Por mes" },
  { mode: "range", label: "Por fechas" },
];

/**
 * El periodo vive en la URL y no en el estado: el Excel, el PDF y un enlace
 * reenviado por WhatsApp tienen que traer exactamente la misma ventana.
 */
export function PeriodPicker({
  period,
  months,
  maxDate,
  baseQuery,
}: {
  period: ReportPeriod;
  months: ReportMonthOption[];
  maxDate: string;
  /** Lo que la pantalla necesita conservar al cambiar de periodo. */
  baseQuery?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<PickerMode>(period.kind);

  function go(query: string) {
    const fullQuery = baseQuery ? `${baseQuery}&${query}` : query;
    router.replace(`${pathname}?${fullQuery}`, { scroll: false });
  }

  return (
    <div className="flat-surface flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
      <div className="flex gap-2" role="group" aria-label="Forma de elegir el periodo">
        {MODES.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => setMode(option.mode)}
            aria-pressed={mode === option.mode}
            className={cn(
              "touch-target flex-1 rounded border px-3 text-sm transition-colors sm:flex-none",
              mode === option.mode
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "month" && (
        <MonthField
          value={period.month ?? undefined}
          months={months}
          onSelect={(month) => go(`mes=${month}`)}
        />
      )}
      {mode === "range" && (
        <RangeFields
          initialFrom={period.fromKey}
          initialTo={period.toKey}
          maxDate={maxDate}
          onApply={(from, to) => go(`desde=${from}&hasta=${to}`)}
        />
      )}
    </div>
  );
}

function MonthField({
  value,
  months,
  onSelect,
}: {
  value: string | undefined;
  months: ReportMonthOption[];
  onSelect: (month: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 sm:w-60">
      <Label htmlFor="report-month">Mes</Label>
      <Select value={value} onValueChange={onSelect}>
        <SelectTrigger id="report-month" className="touch-target w-full">
          <SelectValue placeholder="Elige un mes" />
        </SelectTrigger>
        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RangeFields({
  initialFrom,
  initialTo,
  maxDate,
  onApply,
}: {
  initialFrom: string;
  initialTo: string;
  maxDate: string;
  onApply: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  /* Con botón y no al cambiar cada campo: entre la primera fecha y la segunda
     el rango está a medias, y cada paso dispararía el reporte completo. */
  function submit(event: FormEvent) {
    event.preventDefault();
    if (from && to) onApply(from, to);
  }

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-2 gap-2 sm:flex sm:items-end"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="report-from">Desde</Label>
        <Input
          id="report-from"
          type="date"
          value={from}
          max={maxDate}
          onChange={(event) => setFrom(event.target.value)}
          className="touch-target"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="report-to">Hasta</Label>
        <Input
          id="report-to"
          type="date"
          value={to}
          max={maxDate}
          onChange={(event) => setTo(event.target.value)}
          className="touch-target"
        />
      </div>
      <Button type="submit" className="touch-target col-span-2 sm:col-auto">
        Ver reporte
      </Button>
    </form>
  );
}
