"use client";

import { useState } from "react";
import { Download, FileText, Scissors } from "lucide-react";
import { todayInputValue } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * "Lo cortado": lo que se capturó en la mesa en un día o rango, por orden y
 * talla, para mandárselo al jefe.
 *
 * Fechas PROPIAS y no las del filtro de la lista: aquel filtra órdenes por el
 * día del pedido, y aquí la pregunta es qué se cortó, sin importar cuándo se
 * pidió la orden. Las dos arrancan en hoy porque es el reporte de cada tarde.
 */
export function DailyCutDialog() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(todayInputValue);
  const [to, setTo] = useState(todayInputValue);

  // Una fecha borrada se toma como hoy: un enlace sin fecha no tiene reporte.
  const desde = from || todayInputValue();
  const query = new URLSearchParams({ desde, hasta: to || desde }).toString();

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title="Lo cortado"
      description="Cuenta cada bulto el día en que se capturó."
      trigger={
        <Button variant="outline" className="touch-target">
          <Scissors className="size-4" aria-hidden />
          Lo cortado
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="daily-cut-from">Desde</Label>
            <Input id="daily-cut-from" type="date" value={from}
              onChange={(event) => setFrom(event.target.value)} className="tabular touch-target" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="daily-cut-to">Hasta</Label>
            <Input id="daily-cut-to" type="date" value={to}
              onChange={(event) => setTo(event.target.value)} className="tabular touch-target" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="h-12">
            <a href={`/print/orders/cuts?${query}`} target="_blank" rel="noopener">
              <FileText className="size-4" aria-hidden />
              Imprimir / PDF
            </a>
          </Button>
          <Button asChild className="h-12">
            <a href={`/api/export/daily-cut?${query}`} download>
              <Download className="size-4" aria-hidden />
              Excel
            </a>
          </Button>
        </div>
      </div>
    </ResponsiveFormDialog>
  );
}
