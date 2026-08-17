"use client";

import { useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import type { AuditAction, Sensitivity } from "@prisma/client";
import type { AuditLogWithUser } from "@/lib/repositories/audit.repository";
import { cn, formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Creó",
  UPDATE: "Modificó",
  DELETE: "Dio de baja",
  APPLY: "Aplicó",
  CANCEL: "Canceló",
  RECALCULATE: "Recalculó",
  APPROVE: "Autorizó",
  PRINT: "Imprimió",
  EXPORT: "Exportó",
  LOGIN: "Entró",
  LOGIN_FAILED: "Intento fallido",
  LOGOUT: "Salió",
};

const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

/** Las HIGH y CRITICAL van con fondo sólido: son las que hay que revisar. */
const SENSITIVITY_STYLES: Record<Sensitivity, string> = {
  LOW: "bg-muted text-muted-foreground border border-border",
  MEDIUM: "bg-secondary text-secondary-foreground border border-border",
  HIGH: "bg-state-reserved text-state-reserved-foreground",
  CRITICAL: "bg-state-defective text-state-defective-foreground",
};

const HIGHLIGHTED: Sensitivity[] = ["HIGH", "CRITICAL"];

export function AuditList({ logs }: { logs: AuditLogWithUser[] }) {
  if (logs.length === 0) {
    return (
      <div className="flat-surface">
        <EmptyState
          icon={ShieldAlert}
          title="Sin registros"
          description="No hay movimientos que coincidan con los filtros."
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {logs.map((log) => (
        <AuditRow key={log.id} log={log} />
      ))}
    </ul>
  );
}

function AuditRow({ log }: { log: AuditLogWithUser }) {
  const [expanded, setExpanded] = useState(false);
  const isHighlighted = HIGHLIGHTED.includes(log.sensitivity);

  return (
    <li
      className={cn(
        "flat-surface overflow-hidden",
        // Un borde izquierdo grueso hace que las críticas salten al recorrer
        // la lista, sin necesidad de colorear toda la tarjeta.
        isHighlighted && "border-l-4 border-l-state-defective",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors active:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">
              {ACTION_LABELS[log.action]} {log.entity}
            </span>
            {log.reference && (
              <span className="tabular text-sm text-muted-foreground">
                {log.reference}
              </span>
            )}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs",
                SENSITIVITY_STYLES[log.sensitivity],
              )}
            >
              {SENSITIVITY_LABELS[log.sensitivity]}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {log.userName ?? log.user?.name ?? "Sistema"} ·{" "}
            {formatDateTime(log.createdAt)}
            {log.source && ` · ${log.source}`}
          </p>

          {log.reason && (
            <p className="mt-1 text-xs italic text-muted-foreground">
              {log.reason}
            </p>
          )}

          {log.changedFields.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {log.changedFields.length}{" "}
              {log.changedFields.length === 1 ? "campo" : "campos"}:{" "}
              {log.changedFields.join(", ")}
            </p>
          )}
        </div>

        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded && <AuditDetail log={log} />}
    </li>
  );
}

/** Campo por campo: qué decía antes y qué dice ahora. */
function AuditDetail({ log }: { log: AuditLogWithUser }) {
  const oldValue = asRecord(log.oldValue);
  const newValue = asRecord(log.newValue);

  const fields =
    log.changedFields.length > 0
      ? log.changedFields
      : [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])];

  return (
    <div className="border-t border-border p-3">
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin detalle de campos.</p>
      ) : (
        <dl className="flex flex-col gap-2">
          {fields.map((field) => (
            <div key={field} className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
              <dt className="truncate font-medium">{field}</dt>
              <dd className="flex flex-wrap items-center gap-1.5">
                <span className="tabular rounded border border-border px-1.5 py-0.5 text-muted-foreground line-through">
                  {display(oldValue[field])}
                </span>
                <span aria-hidden>→</span>
                <span className="tabular rounded bg-secondary px-1.5 py-0.5">
                  {display(newValue[field])}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
        {log.ip && <>IP {log.ip} · </>}
        {log.userAgent && <span className="break-all">{log.userAgent}</span>}
      </p>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Los valores llegan como JSON: pueden ser objetos, fechas o null. */
function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
