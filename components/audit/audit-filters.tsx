"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { AuditAction, Sensitivity } from "@prisma/client";
import { cn } from "@/lib/utils";
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

const ACTIONS: { value: AuditAction; label: string }[] = [
  { value: "CREATE", label: "Creación" },
  { value: "UPDATE", label: "Modificación" },
  { value: "DELETE", label: "Baja" },
  { value: "APPLY", label: "Aplicación" },
  { value: "CANCEL", label: "Cancelación" },
  { value: "APPROVE", label: "Autorización" },
];

const SENSITIVITIES: { value: Sensitivity; label: string }[] = [
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
  { value: "CRITICAL", label: "Crítica" },
];

interface Props {
  actors: { id: string; name: string }[];
  entities: string[];
}

export function AuditFilters({ actors, entities }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  const sensitivity = searchParams.get("sensitivity");
  const hasFilters = [...searchParams.keys()].length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Atajo al caso más frecuente: "enséñame lo grave". */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <QuickChip
          label="Sensibilidad alta"
          active={sensitivity === "HIGH"}
          onClick={() => setParam("sensitivity", sensitivity === "HIGH" ? null : "HIGH")}
        />
        <QuickChip
          label="Críticas"
          active={sensitivity === "CRITICAL"}
          onClick={() =>
            setParam("sensitivity", sensitivity === "CRITICAL" ? null : "CRITICAL")
          }
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => router.replace(pathname)}
            className="touch-target flex shrink-0 items-center gap-1.5 rounded border border-border bg-card px-3 text-sm text-muted-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Limpiar
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Filter
          label="Usuario"
          value={searchParams.get("userId")}
          options={actors.map((actor) => ({ value: actor.id, label: actor.name }))}
          onChange={(value) => setParam("userId", value)}
        />
        <Filter
          label="Entidad"
          value={searchParams.get("entity")}
          options={entities.map((entity) => ({ value: entity, label: entity }))}
          onChange={(value) => setParam("entity", value)}
        />
        <Filter
          label="Acción"
          value={searchParams.get("action")}
          options={ACTIONS.map((action) => ({ value: action.value, label: action.label }))}
          onChange={(value) => setParam("action", value)}
        />
        <Filter
          label="Sensibilidad"
          value={sensitivity}
          options={SENSITIVITIES.map((item) => ({ value: item.value, label: item.label }))}
          onChange={(value) => setParam("sensitivity", value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="from">Desde</Label>
          <Input
            id="from"
            type="date"
            className="touch-target tabular"
            value={searchParams.get("from") ?? ""}
            onChange={(event) => setParam("from", event.target.value || null)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="to">Hasta</Label>
          <Input
            id="to"
            type="date"
            className="touch-target tabular"
            value={searchParams.get("to") ?? ""}
            onChange={(event) => setParam("to", event.target.value || null)}
          />
        </div>
      </div>

      <Button asChild variant="outline" className="touch-target w-fit">
        <a href="/api/export/audit" download>
          Exportar a Excel
        </a>
      </Button>
    </div>
  );
}

function QuickChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "touch-target shrink-0 rounded border px-3 text-sm transition-colors",
        active
          ? "border-primary bg-primary font-medium text-primary-foreground"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select
        value={value ?? "all"}
        onValueChange={(next) => onChange(next === "all" ? null : next)}
      >
        <SelectTrigger className="touch-target w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
