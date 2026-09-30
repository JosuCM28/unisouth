"use client";

import { useState } from "react";
import { Mail, MessageCircle, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { sendVoucherEmailAction } from "@/app/actions/email.actions";
import { sendVoucherWhatsappAction } from "@/app/actions/whatsapp.actions";
import type { EmailRecipient } from "@/lib/repositories/email-contact.repository";
import type { WhatsappRecipient } from "@/lib/repositories/whatsapp-contact.repository";
import type { NotificationChannel } from "@/lib/validations/notification-settings.schema";
import { runAction } from "@/lib/offline/run-action";
import { formatPhone } from "@/lib/phone";
import { RecipientList, type RecipientItem } from "./recipient-list";

/** Lo que la ficha del vale sabe de un canal para ofrecer el envío. */
export interface DeliveryChannel<TContact> {
  /** Si ADMIN lo tiene prendido. Apagado, ni siquiera se menciona. */
  enabled: boolean;
  /** Si el servidor tiene sus variables de entorno. */
  configured: boolean;
  contacts: TContact[];
}

export interface VoucherDeliveryOptions {
  whatsapp: DeliveryChannel<WhatsappRecipient>;
  email: DeliveryChannel<EmailRecipient>;
}

const CHANNELS: NotificationChannel[] = ["whatsapp", "email"];

const CHANNEL_TITLES: Record<NotificationChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Correo",
};

const CHANNEL_ICONS: Record<NotificationChannel, LucideIcon> = {
  whatsapp: MessageCircle,
  email: Mail,
};

/**
 * Por qué no se puede enviar, dicho en el diálogo.
 *
 * Se explica en vez de esconder el canal: uno prendido que no aparece no le
 * dice a nadie que faltan las variables del servidor o los contactos, y
 * quien lo busca acaba creyendo que la función no existe.
 */
const NOT_CONFIGURED: Record<NotificationChannel, string> = {
  whatsapp:
    "WhatsApp no está configurado en el servidor: faltan las variables EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE.",
  email:
    "El correo no está configurado en el servidor: falta la variable RESEND_API_KEY.",
};

const NO_CONTACTS: Record<NotificationChannel, string> = {
  whatsapp:
    "No hay contactos de WhatsApp: un administrador los da de alta en Administración → Notificaciones.",
  email:
    "No hay correos: un administrador los da de alta en Administración → Notificaciones.",
};

/** ¿Se puede mandar por este canal? Prendido, configurado y con a quién. */
function isUsable(channel: DeliveryChannel<unknown>): boolean {
  return channel.enabled && channel.configured && channel.contacts.length > 0;
}

/** ¿Hay al menos un canal por el que se pueda mandar el vale? */
export function canDeliver(options: VoucherDeliveryOptions): boolean {
  return CHANNELS.some((channel) => isUsable(options[channel]));
}

/** ¿ADMIN dejó prendido algún canal? Si no, no hay nada que mencionar. */
export function anyChannelEnabled(options: VoucherDeliveryOptions): boolean {
  return CHANNELS.some((channel) => options[channel].enabled);
}

/** Los contactos de cada canal, como los pinta la lista. */
function itemsOf(
  options: VoucherDeliveryOptions,
): Record<NotificationChannel, RecipientItem[]> {
  return {
    whatsapp: options.whatsapp.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      detail: formatPhone(c.phone),
      active: c.active,
    })),
    email: options.email.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      detail: c.email,
      active: c.active,
    })),
  };
}

export type DeliverySelection = Record<NotificationChannel, Set<string>>;

/**
 * Qué contactos van marcados en este envío, canal por canal.
 *
 * Arranca con los ACTIVOS de los canales que sí se pueden usar: son "los de
 * siempre", y lo normal es mandar a todos. Quitar a uno para este vale no lo
 * toca en la lista.
 */
export function useDeliverySelection(options: VoucherDeliveryOptions) {
  const initial = (): DeliverySelection => ({
    whatsapp: activeIds(options.whatsapp),
    email: activeIds(options.email),
  });

  const [selected, setSelected] = useState<DeliverySelection>(initial);

  function toggle(channel: NotificationChannel, id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current[channel]);
      if (checked) next.add(id);
      else next.delete(id);
      return { ...current, [channel]: next };
    });
  }

  return {
    selected,
    toggle,
    total: selected.whatsapp.size + selected.email.size,
    reset: () => setSelected(initial()),
  };
}

function activeIds(channel: DeliveryChannel<{ id: string; active: boolean }>) {
  if (!isUsable(channel)) return new Set<string>();
  return new Set(channel.contacts.filter((c) => c.active).map((c) => c.id));
}

/**
 * Los canales prendidos, cada uno con su lista o con el motivo de por qué
 * no se puede usar. Los apagados no aparecen: ADMIN ya decidió que no.
 */
export function DeliveryRecipients({
  options,
  selected,
  onToggle,
}: {
  options: VoucherDeliveryOptions;
  selected: DeliverySelection;
  onToggle: (channel: NotificationChannel, id: string, checked: boolean) => void;
}) {
  const items = itemsOf(options);

  return (
    <div className="flex flex-col gap-4">
      {CHANNELS.filter((channel) => options[channel].enabled).map((channel) => {
        const Icon = CHANNEL_ICONS[channel];

        return (
          <section key={channel} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Icon className="size-4" aria-hidden />
              {CHANNEL_TITLES[channel]}
            </h3>

            <ChannelBody
              channel={channel}
              options={options[channel]}
              items={items[channel]}
              selected={selected[channel]}
              onToggle={(id, checked) => onToggle(channel, id, checked)}
            />
          </section>
        );
      })}
    </div>
  );
}

export function ChannelBody({
  channel,
  options,
  items,
  selected,
  onToggle,
}: {
  channel: NotificationChannel;
  options: DeliveryChannel<unknown>;
  items: RecipientItem[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  if (!options.configured) return <Notice text={NOT_CONFIGURED[channel]} />;
  if (items.length === 0) return <Notice text={NO_CONTACTS[channel]} />;

  return (
    <RecipientList
      idPrefix={channel}
      items={items}
      selected={selected}
      onToggle={onToggle}
    />
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="border border-border bg-muted p-2 text-xs text-muted-foreground">
      {text}
    </p>
  );
}

/**
 * Manda el vale por cada canal que tenga a alguien marcado.
 *
 * Los dos canales van a la vez: salen de servidores distintos, así que no se
 * estorban, y el correo no tiene por qué esperar a que WhatsApp termine su
 * fila de contactos. Cada uno avisa por su lado cómo le fue.
 */
export async function deliverVoucher(
  documentId: string,
  selected: DeliverySelection,
): Promise<void> {
  const sends: Promise<void>[] = [];

  if (selected.whatsapp.size > 0) {
    sends.push(
      reportDelivery("WhatsApp", () =>
        sendVoucherWhatsappAction({
          documentId,
          contactIds: [...selected.whatsapp],
        }),
      ),
    );
  }

  if (selected.email.size > 0) {
    sends.push(
      reportDelivery("correo", () =>
        sendVoucherEmailAction({ documentId, contactIds: [...selected.email] }),
      ),
    );
  }

  await Promise.all(sends);
}

export type DeliveryResponse = Awaited<ReturnType<typeof sendVoucherEmailAction>>;

/**
 * Tres desenlaces y tres avisos distintos: a todos, a algunos —con los
 * nombres que faltaron, para reenviarles sólo a ellos— y a nadie.
 */
export async function reportDelivery(
  via: string,
  send: () => Promise<DeliveryResponse>,
): Promise<void> {
  const result = await runAction(send);

  if (!result.success) {
    toast.error(`No se pudo enviar por ${via}. ${result.error}`);
    return;
  }

  const { sent, failed } = result.data;

  if (failed.length === 0) {
    toast.success(`Enviado por ${via} a ${sent.join(", ")}`);
    return;
  }

  const detail = failed.map((f) => `${f.name}: ${f.reason}`).join(" · ");

  if (sent.length === 0) {
    toast.error(`No se pudo enviar por ${via}. ${sharedReason(failed) ?? detail}`);
    return;
  }

  toast.warning(`Enviado por ${via} a ${sent.join(", ")}. No llegó a ${detail}`);
}

/**
 * El motivo, si todos fallaron por lo mismo.
 *
 * El correo sale en UN envío con todos los destinatarios, así que cuando
 * falla, falla igual para todos: repetir la misma razón cinco veces sólo
 * esconde que el problema es uno.
 */
function sharedReason(failed: { reason: string }[]): string | null {
  const reasons = new Set(failed.map((f) => f.reason));
  return reasons.size === 1 ? (failed[0]?.reason ?? null) : null;
}
