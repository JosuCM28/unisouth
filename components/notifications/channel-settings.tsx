"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateNotificationChannelsAction } from "@/app/actions/notification.actions";
import { runAction } from "@/lib/offline/run-action";
import type {
  NotificationChannel,
  NotificationChannels,
} from "@/lib/validations/notification-settings.schema";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  channels: NotificationChannels;
  /** Si el servidor tiene las variables de cada canal. */
  configured: Record<NotificationChannel, boolean>;
}

const TITLES: Record<NotificationChannel, string> = {
  whatsapp: "Enviar por WhatsApp",
  email: "Enviar por correo",
};

const MISSING_ENV: Record<NotificationChannel, string> = {
  whatsapp: "faltan EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE",
  email: "falta RESEND_API_KEY",
};

const CHANNELS: NotificationChannel[] = ["whatsapp", "email"];

/**
 * Los interruptores de cada canal.
 *
 * Se guardan al tocarlos, sin botón de "Guardar": son dos interruptores, y
 * un formulario para dos valores sólo agrega el paso que alguien olvida.
 */
export function ChannelSettings({ channels, configured }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(channels);
  const [saving, setSaving] = useState(false);

  async function handleChange(channel: NotificationChannel, checked: boolean) {
    const previous = value;
    const next = { ...value, [channel]: checked };
    setValue(next);
    setSaving(true);

    const result = await runAction(() => updateNotificationChannelsAction(next));
    setSaving(false);

    if (!result.success) {
      setValue(previous);
      toast.error(result.error);
      return;
    }

    toast.success("Canales actualizados");
    router.refresh();
  }

  return (
    <ul className="flex flex-col gap-2">
      {CHANNELS.map((channel) => (
        <li key={channel}>
          <Label
            htmlFor={`channel-${channel}`}
            className="flat-surface touch-target flex cursor-pointer items-center justify-between gap-3 p-3"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{TITLES[channel]}</span>
              <StatusLine
                enabled={value[channel]}
                configured={configured[channel]}
                missing={MISSING_ENV[channel]}
              />
            </span>
            <Switch
              id={`channel-${channel}`}
              checked={value[channel]}
              disabled={saving}
              onCheckedChange={(checked) => handleChange(channel, checked)}
            />
          </Label>
        </li>
      ))}
    </ul>
  );
}

/** Qué pasará al aplicar una salida, dicho en una línea. */
function StatusLine({
  enabled,
  configured,
  missing,
}: {
  enabled: boolean;
  configured: boolean;
  missing: string;
}) {
  if (!enabled) {
    return (
      <span className="text-xs font-normal text-muted-foreground">
        Apagado: no se ofrece al aplicar una salida
      </span>
    );
  }

  if (!configured) {
    return (
      <span className="text-xs font-normal text-state-reserved">
        Prendido, pero no se puede enviar: {missing} en el servidor
      </span>
    );
  }

  return (
    <span className="text-xs font-normal text-muted-foreground">
      Se ofrece al aplicar una salida
    </span>
  );
}
