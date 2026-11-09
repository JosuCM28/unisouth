"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import {
  listOrderDispatchOptionsAction,
  markOrderDispatchedAction,
} from "@/app/actions/order-dispatch.actions";
import { runAction } from "@/lib/offline/run-action";
import type { DispatchOption } from "@/lib/services/order-dispatch.service";
import { cn, formatDate, formatQuantity } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function optionKey(option: { kind: string; id: string }): string {
  return `${option.kind}:${option.id}`;
}

function canSelect(option: DispatchOption): boolean {
  return !option.dispatchedAt && !option.blockedReason;
}

/**
 * Marca qué se está yendo de la planta de corte.
 *
 * Las opciones se piden al abrir y no vienen con la tabla: son cincuenta
 * renglones y casi nunca se abre uno, así que cargarlas todas sería traer
 * cincuenta veces algo que no se va a mirar.
 */
export function OrderDispatchDialog({
  orderId,
  orderCode,
  className,
}: {
  orderId: string;
  orderCode: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DispatchOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    setOptions(null);
    setSelected(new Set());

    const result = await runAction(() =>
      listOrderDispatchOptionsAction({ orderId }),
    );

    if (!result.success) {
      toast.error(result.error);
      setOpen(false);
      return;
    }

    setOptions(result.data);
  }

  function handleOpenChange(next: boolean) {
    if (isSaving) return;
    setOpen(next);
    if (next) void load();
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleConfirm() {
    const items = (options ?? [])
      .filter((option) => selected.has(optionKey(option)))
      .map((option) => ({ kind: option.kind, id: option.id }));

    setIsSaving(true);
    const result = await runAction(() =>
      markOrderDispatchedAction({ orderId, items }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Marcado como enviado");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Enviar ${orderCode}`}
      description="Elige lo que sale hoy de la planta. Queda con la fecha de hoy y el taller lo verá."
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("touch-target", className)}
        >
          <Send className="size-4" aria-hidden />
          Enviar
        </Button>
      }
    >
      <DialogBody
        options={options}
        selected={selected}
        onToggle={toggle}
        onConfirm={handleConfirm}
        isSaving={isSaving}
      />
    </ResponsiveFormDialog>
  );
}

function DialogBody({
  options,
  selected,
  onToggle,
  onConfirm,
  isSaving,
}: {
  options: DispatchOption[] | null;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onConfirm: () => void;
  isSaving: boolean;
}) {
  if (options === null) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta orden todavía no tiene envíos a taller ni salidas de corte.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {options.map((option) => (
          <OptionRow
            key={optionKey(option)}
            option={option}
            checked={selected.has(optionKey(option))}
            onToggle={onToggle}
          />
        ))}
      </ul>

      <SubmitButton
        isSubmitting={isSaving}
        onClick={onConfirm}
        disabled={selected.size === 0}
        className="h-12 w-full"
      >
        Marcar como enviado
      </SubmitButton>
    </div>
  );
}

function OptionRow({
  option,
  checked,
  onToggle,
}: {
  option: DispatchOption;
  checked: boolean;
  onToggle: (key: string) => void;
}) {
  const enabled = canSelect(option);

  return (
    <li>
      <label
        className={cn(
          "touch-target flat-surface flex items-start gap-3 p-3",
          enabled ? "cursor-pointer" : "text-muted-foreground",
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0"
          checked={checked}
          disabled={!enabled}
          onChange={() => onToggle(optionKey(option))}
        />
        <span className="flex min-w-0 flex-col">
          <span className="tabular text-sm font-medium">{option.code}</span>
          <span className="break-words text-sm">{option.title}</span>
          <span className="tabular text-xs text-muted-foreground">
            {option.detail && `${option.detail} · `}
            {formatQuantity(option.pieces)} pzas · {option.bundles} bultos
          </span>
          <OptionStatus option={option} />
        </span>
      </label>
    </li>
  );
}

function OptionStatus({ option }: { option: DispatchOption }) {
  if (option.dispatchedAt) {
    return (
      <span className="tabular text-xs font-medium">
        Enviado el {formatDate(option.dispatchedAt)}
        {option.dispatchedByName && ` por ${option.dispatchedByName}`}
      </span>
    );
  }

  if (option.blockedReason) {
    return <span className="text-xs font-medium">{option.blockedReason}</span>;
  }

  return null;
}
