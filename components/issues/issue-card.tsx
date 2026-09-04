import Link from "next/link";
import { CalendarDays, HandHelping, Scissors, Send, User } from "lucide-react";
import type { DocumentStatus, Unit } from "@prisma/client";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_STYLES,
  UNIT_SHORT_LABELS,
} from "@/lib/constants/labels";
import type { IssueSummary } from "@/lib/issue-summary";
import { cn, formatDate, formatQuantity } from "@/lib/utils";

export interface IssueRow {
  id: string;
  code: string;
  status: DocumentStatus;
  date: Date;
  concept: string | null;
  reference: string | null;
  clientName: string | null;
  /**
   * Quién se llevó el material ("ELVIA", "ING. OMAR").
   *
   * Es texto libre y no un catálogo a propósito: quien recibe puede ser del
   * taller, de otra planta o un chofer, y frenar la salida porque falta dar
   * de alta a la persona es lo que devuelve al auxiliar a la libreta.
   */
  receivedBy: string | null;
  /** Tela del desglose de corte: identifica el vale cuando no lleva rollos. */
  cutFabricName: string | null;
  cutDescription: string | null;
  /**
   * El envío a taller que levantó este vale, cuando nació de uno.
   *
   * Sin esto los vales de maquila eran indistinguibles del resto: mismo folio
   * OUT, y lo único que los delataba era el nombre de quien recibió, que
   * también puede ser una persona de la casa. Quien busca "¿qué anda en el
   * taller?" tenía que abrirlos uno por uno.
   */
  shipment: {
    code: string;
    workshopName: string;
    stageName: string;
  } | null;
  summary: IssueSummary;
}

/**
 * Tarjeta de una salida.
 *
 * Antes sólo se veían folio, fecha y cuántos renglones traía, así que había
 * que abrir el vale para saber qué tela salió y cuánta. Ahora el METRAJE va
 * grande a la derecha y la tela debajo del folio: son las dos cosas que se
 * quieren cotejar contra lo que pidió producción.
 *
 * Un vale puede no llevar rollos —se manda al taller lo ya cortado— y en ese
 * caso lo que lo identifica es la tela del corte y las prendas, no el
 * metraje. Por eso se pinta lo que haya, en vez de un cero que confunde.
 */
export function IssueCard({ issue }: { issue: IssueRow }) {
  const { summary } = issue;
  const unitLabel = summary.unit ? UNIT_SHORT_LABELS[summary.unit as Unit] : "";
  const title = issue.concept ?? issue.cutDescription;

  return (
    <Link
      href={`/documents/${issue.id}`}
      className="flat-surface block p-3 transition-colors active:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-sm font-medium">{issue.code}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs",
                DOCUMENT_STATUS_STYLES[issue.status],
              )}
            >
              {DOCUMENT_STATUS_LABELS[issue.status]}
            </span>

            {/* Va arriba, junto al folio, y no abajo con los demás chips: es
                lo que contesta "¿esta salida de qué es?" antes de leer nada
                más, y en una lista de cincuenta se recorre con la vista por
                esa columna. */}
            {issue.shipment && (
              <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                <Send className="size-3 shrink-0" aria-hidden />A taller
              </span>
            )}
          </div>

          {/* La tela de los rollos; si el vale es sólo de cortes, la del
              desglose, que es lo único que dice de qué se trata. */}
          {summary.materialNames.length > 0 && (
            <p className="mt-1 truncate text-sm font-medium">
              {summary.materialNames.join(" · ")}
            </p>
          )}
          {summary.materialNames.length === 0 && issue.cutFabricName && (
            <p className="mt-1 truncate text-sm font-medium">
              {issue.cutFabricName}
            </p>
          )}

          {title && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {title}
            </p>
          )}

          {/* Fecha y quién recibió, en el mismo renglón chico: son las dos
              cosas que se cotejan cuando alguien reclama un material —"¿cuándo
              salió y quién se lo llevó?"— y separarlas obligaría a leer dos
              lugares de la tarjeta. */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3 shrink-0" aria-hidden />
              <span className="tabular">{formatDate(issue.date)}</span>
            </span>

            {issue.receivedBy && (
              <span className="flex min-w-0 items-center gap-1.5">
                <HandHelping className="size-3 shrink-0" aria-hidden />
                <span className="truncate">Recibió {issue.receivedBy}</span>
              </span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {summary.totalQuantity > 0 && (
            <p className="tabular text-2xl font-semibold leading-none">
              {formatQuantity(summary.totalQuantity, { unit: unitLabel })}
            </p>
          )}
          {summary.lots > 0 && (
            <p className="tabular mt-0.5 text-xs text-muted-foreground">
              {summary.lots} {summary.lots === 1 ? "rollo" : "rollos"}
            </p>
          )}
          {summary.cutPieces > 0 && (
            <p className="tabular mt-0.5 flex items-center justify-end gap-1 text-xs text-muted-foreground">
              <Scissors className="size-3 shrink-0" aria-hidden />
              {formatQuantity(summary.cutPieces)} pzas
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {/* Etapa y taller juntos —"SERIGRAFIADO · ING.OMAR"— porque así se
            nombra el envío en el piso y así va impreso en el vale. El folio
            del envío al lado, que es por donde se cruza con la ficha de la
            orden.

            No se liga a la orden aunque se sepa cuál es: la tarjeta entera ya
            es un enlace al vale, y un `<a>` dentro de otro es HTML inválido
            —el navegador rompe la tarjeta—. Para llegar a la orden está su
            folio en "Ref.". */}
        {issue.shipment && (
          <>
            <Chip
              icon={Send}
              label={`${issue.shipment.stageName} · ${issue.shipment.workshopName}`}
            />
            <span className="tabular flex max-w-full items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              <span className="truncate">{issue.shipment.code}</span>
            </span>
          </>
        )}
        {issue.clientName && <Chip icon={User} label={issue.clientName} />}
        {issue.reference && (
          <span className="tabular flex max-w-full items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
            <span className="truncate">Ref. {issue.reference}</span>
          </span>
        )}
      </div>

      {/* Un vale sin rollos ni cortes es una captura a medias: se avisa en
          vez de dejar una tarjeta que no dice nada. */}
      {summary.lots === 0 && summary.cutPieces === 0 && (
        <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
          Sin rollos ni desglose capturado.
        </p>
      )}
    </Link>
  );
}

function Chip({
  icon: Icon,
  label,
}: {
  icon: typeof User;
  label: string;
}) {
  return (
    <span className="flex max-w-full items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
