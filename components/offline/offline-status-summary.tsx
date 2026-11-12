import { Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tres datos de un vistazo: ¿hay señal?, ¿cuánto falta por subir? y ¿cuántas
 * capturas rebotó el servidor?
 *
 * Los rechazos van aparte de los pendientes porque piden algo distinto: un
 * pendiente se sube solo al volver la señal, un rechazo NO —hay que
 * corregirlo o descartarlo desde la franja de capturas pendientes—.
 */
export function OfflineStatusSummary({
  online,
  pending,
  rejected,
}: {
  online: boolean;
  pending: number;
  rejected: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <ConnectionTile online={online} />
      <CountTile label="Por subir" value={pending} />
      <CountTile label="Rechazadas" value={rejected} alert={rejected > 0} />
    </div>
  );
}

function ConnectionTile({ online }: { online: boolean }) {
  const Icon = online ? Cloud : CloudOff;

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-[4px] border p-3",
        online
          ? "border-state-available bg-state-available-muted"
          : "border-state-reserved bg-state-reserved-muted",
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="text-xs font-medium">
        {online ? "En línea" : "Sin conexión"}
      </span>
    </div>
  );
}

function CountTile({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-[4px] border p-3",
        alert
          ? "border-state-defective bg-state-defective-muted"
          : "border-border bg-card",
      )}
    >
      <span className="tabular text-lg leading-none font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
