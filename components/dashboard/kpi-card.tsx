import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "positive" | "warning" | "critical";

interface KpiCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  href?: string;
}

/**
 * Diccionario en vez de ternarias encadenadas: agregar un tono nuevo es
 * agregar una línea aquí, sin tocar el JSX.
 */
const TONE_STYLES: Record<KpiTone, string> = {
  neutral: "text-foreground",
  positive: "text-state-available",
  warning: "text-state-reserved",
  critical: "text-state-defective",
};

const TONE_ACCENT: Record<KpiTone, string> = {
  neutral: "bg-border",
  positive: "bg-state-available",
  warning: "bg-state-reserved",
  critical: "bg-state-defective",
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: KpiCardProps) {
  const content = (
    <>
      {/* Franja de color en el borde: comunica el estado sin recurrir a
          sombras ni a rellenar toda la tarjeta. */}
      <span
        className={cn("absolute inset-y-0 left-0 w-1", TONE_ACCENT[tone])}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </div>

      <p className={cn("tabular mt-2 text-2xl font-semibold", TONE_STYLES[tone])}>
        {value}
      </p>

      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const className = cn(
    "flat-surface relative overflow-hidden p-4 pl-5",
    href && "transition-colors hover:bg-accent",
  );

  if (href) {
    return (
      <Link href={href} className={cn(className, "block")}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
