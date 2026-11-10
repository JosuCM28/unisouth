"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { WorkshopBoardKey } from "@/lib/constants/workshop-access";
import type { ReportMonthOption } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
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

type Mode = "month" | "range";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "month", label: "Por mes" },
  { mode: "range", label: "Por fechas" },
];

interface Props {
  boardKey: WorkshopBoardKey;
  months: ReportMonthOption[];
  /** Hoy en la fábrica: tope del rango, porque el futuro no tiene entregas. */
  today: string;
  /** Lo escrito en el buscador del tablero: el Excel sale filtrado igual. */
  search: string;
}

/**
 * Elige el periodo y baja el reporte del tablero.
 *
 * Un enlace de descarga y no una acción: el archivo lo arma la ruta con la
 * sesión de quien lo pide, y así el navegador lo guarda como cualquier otro.
 */
export function BoardReportDialog({ boardKey, months, today, search }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("month");
  const [month, setMonth] = useState(months[0]?.value ?? today.slice(0, 7));
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);

  const href = reportHref({ boardKey, mode, month, from, to, search });
  const ready = mode === "month" || Boolean(from && to);

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Reporte en Excel"
      description="Lo enviado en el periodo, con su estado de hoy, gráficas y el detalle por talla."
      trigger={
        <Button type="button" variant="outline" className="touch-target">
          <FileSpreadsheet className="size-4" aria-hidden />
          Reporte Excel
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2" role="group" aria-label="Forma de elegir el periodo">
          {MODES.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              aria-pressed={mode === option.mode}
              className={cn(
                "touch-target flex-1 rounded border px-3 text-sm transition-colors",
                mode === option.mode
                  ? "border-primary bg-primary font-medium text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === "month" ? (
          <MonthField value={month} months={months} onChange={setMonth} />
        ) : (
          <RangeFields from={from} to={to} max={today} onFrom={setFrom} onTo={setTo} />
        )}

        {search.trim() && (
          <p className="text-sm text-muted-foreground">
            Sale filtrado por “{search.trim()}”, igual que el tablero.
          </p>
        )}

        <Button asChild={ready} disabled={!ready} className="h-12 w-full">
          {ready ? (
            <a href={href} download onClick={() => setOpen(false)}>
              <FileSpreadsheet className="size-4" aria-hidden />
              Descargar Excel
            </a>
          ) : (
            <span>Elige las dos fechas</span>
          )}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

function reportHref(input: {
  boardKey: WorkshopBoardKey;
  mode: Mode;
  month: string;
  from: string;
  to: string;
  search: string;
}): string {
  const params = new URLSearchParams();
  if (input.mode === "month") params.set("mes", input.month);
  else {
    params.set("desde", input.from);
    params.set("hasta", input.to);
  }
  if (input.search.trim()) params.set("q", input.search.trim());
  return `/api/export/workshop-board/${input.boardKey}?${params}`;
}

function MonthField({
  value,
  months,
  onChange,
}: {
  value: string;
  months: ReportMonthOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="board-report-month">Mes</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="board-report-month" className="touch-target w-full">
          <SelectValue placeholder="Elige un mes" />
        </SelectTrigger>
        <SelectContent>
          {months.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RangeFields({
  from,
  to,
  max,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  max: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="board-report-from">Desde</Label>
        <Input
          id="board-report-from"
          type="date"
          value={from}
          max={max}
          onChange={(event) => onFrom(event.target.value)}
          className="touch-target"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="board-report-to">Hasta</Label>
        <Input
          id="board-report-to"
          type="date"
          value={to}
          max={max}
          onChange={(event) => onTo(event.target.value)}
          className="touch-target"
        />
      </div>
    </div>
  );
}
