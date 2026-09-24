"use client";

import { useState } from "react";
import { toast } from "sonner";
import { sendVoucherWhatsappAction } from "@/app/actions/whatsapp.actions";
import type { WhatsappRecipient } from "@/lib/repositories/whatsapp-contact.repository";
import { runAction } from "@/lib/offline/run-action";
import { formatPhone } from "@/lib/phone";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Lo que la ficha del vale sabe de WhatsApp para ofrecer el envío. */
export interface VoucherWhatsappOptions {
  /** Si el servidor tiene las variables de Evolution. */
  configured: boolean;
  contacts: WhatsappRecipient[];
}

/** ¿Se puede ofrecer el envío? Sin configurar o sin contactos, no. */
export function canSendWhatsapp(options: VoucherWhatsappOptions): boolean {
  return options.configured && options.contacts.length > 0;
}

/**
 * Qué contactos van marcados en este envío.
 *
 * Arranca con los ACTIVOS: son "los de siempre", y lo normal es mandar a
 * todos. Quitar a uno para este vale no lo toca en la lista.
 */
export function useRecipientSelection(contacts: WhatsappRecipient[]) {
  const initial = () =>
    new Set(contacts.filter((c) => c.active).map((c) => c.id));

  const [selected, setSelected] = useState<Set<string>>(initial);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return {
    selected,
    toggle,
    reset: () => setSelected(initial()),
  };
}

/**
 * Por qué no se puede enviar, dicho en el diálogo.
 *
 * Se explica en vez de esconder el botón: un botón que no aparece no le dice
 * a nadie que faltan las variables del servidor o los contactos, y quien lo
 * busca acaba creyendo que la función no existe.
 */
export function WhatsappUnavailable({
  whatsapp,
  suffix,
}: {
  whatsapp: VoucherWhatsappOptions;
  suffix?: string;
}) {
  if (canSendWhatsapp(whatsapp)) return null;

  const reason = whatsapp.configured
    ? "No hay contactos de WhatsApp: un administrador los da de alta en Administración → WhatsApp."
    : "WhatsApp no está configurado en el servidor: faltan las variables EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE.";

  return (
    <p className="border border-border bg-muted p-2 text-xs text-muted-foreground">
      {reason}
      {suffix && ` ${suffix}`}
    </p>
  );
}

/** La lista de contactos, cada uno con su interruptor. */
export function WhatsappRecipients({
  contacts,
  selected,
  onToggle,
}: {
  contacts: WhatsappRecipient[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
      {contacts.map((contact) => (
        <li key={contact.id}>
          <Label
            htmlFor={`wa-${contact.id}`}
            className="flat-surface touch-target flex cursor-pointer items-center justify-between gap-3 p-3"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{contact.name}</span>
              <span className="tabular text-xs font-normal text-muted-foreground">
                {formatPhone(contact.phone)}
              </span>
            </span>
            <Switch
              id={`wa-${contact.id}`}
              checked={selected.has(contact.id)}
              onCheckedChange={(checked) => onToggle(contact.id, checked)}
            />
          </Label>
        </li>
      ))}
    </ul>
  );
}

/**
 * Manda el vale y dice cómo le fue a cada quien.
 *
 * Tres desenlaces y tres avisos distintos: a todos, a algunos —con los
 * nombres que faltaron, para reenviarles sólo a ellos— y a nadie.
 */
export async function sendVoucherByWhatsapp(
  documentId: string,
  contactIds: string[],
): Promise<void> {
  const result = await runAction(() =>
    sendVoucherWhatsappAction({ documentId, contactIds }),
  );

  if (!result.success) {
    toast.error(result.error);
    return;
  }

  const { sent, failed } = result.data;

  if (failed.length === 0) {
    toast.success(`Enviado por WhatsApp a ${sent.join(", ")}`);
    return;
  }

  const detail = failed.map((f) => `${f.name}: ${f.reason}`).join(" · ");

  if (sent.length === 0) {
    toast.error(`No se pudo enviar por WhatsApp. ${detail}`);
    return;
  }

  toast.warning(`Enviado a ${sent.join(", ")}. No llegó a ${detail}`);
}
