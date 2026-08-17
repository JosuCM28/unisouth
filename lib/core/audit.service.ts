import type { AuditAction, Sensitivity } from "@prisma/client";
import { prisma, type PrismaExecutor } from "@/lib/prisma";
import { ValidationError } from "./errors";

/**
 * Quién está haciendo el cambio y desde dónde.
 *
 * Se arma una sola vez por petición (buildAuditContext) y se pasa hacia
 * abajo, para no andar leyendo headers() dentro de los servicios.
 */
export interface AuditContext {
  userId?: string;
  userName?: string;
  ip?: string;
  userAgent?: string;
  /** Origen del cambio: "web", "movil", "seed", "script". */
  source?: string;
}

export interface AuditRecordInput {
  entity: string;
  entityId?: string;
  action: AuditAction;
  /** Folio legible del registro afectado, para buscar sin conocer el id. */
  reference?: string;
  oldValue?: unknown;
  newValue?: unknown;
  sensitivity?: Sensitivity;
  reason?: string;
}

/** Sobre estos cambios siempre se exige motivo. */
const REQUIRES_REASON: Sensitivity[] = ["HIGH", "CRITICAL"];

/**
 * Bitácora de "quién metió mano".
 *
 * Responde una pregunta distinta a la del kárdex: Movement dice qué pasó con
 * el rollo; AuditLog dice quién editó qué campo, cuándo y desde qué equipo.
 *
 * Es la única puerta de escritura de AuditLog. Nunca un
 * `prisma.auditLog.create` suelto por ahí.
 */
export class AuditService {
  private readonly db: PrismaExecutor;
  private readonly context: AuditContext;

  constructor(context: AuditContext = {}, db: PrismaExecutor = prisma) {
    this.context = context;
    this.db = db;
  }

  async record(input: AuditRecordInput): Promise<void> {
    const sensitivity = input.sensitivity ?? "LOW";

    // Un ajuste de cantidad o una baja sin explicación no sirve de nada seis
    // meses después, cuando alguien pregunte por qué faltan 40 metros.
    if (REQUIRES_REASON.includes(sensitivity) && !input.reason?.trim()) {
      throw new ValidationError(
        "Este cambio requiere un motivo.",
        "reason",
      );
    }

    const changedFields = this.diff(input.oldValue, input.newValue);

    await this.db.auditLog.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        reference: input.reference,
        oldValue: this.toJson(input.oldValue),
        newValue: this.toJson(input.newValue),
        changedFields,
        sensitivity,
        reason: input.reason?.trim() || null,
        userId: this.context.userId,
        userName: this.context.userName,
        ip: this.context.ip,
        userAgent: this.context.userAgent,
        source: this.context.source,
      },
    });
  }

  /**
   * Qué campos cambiaron realmente.
   *
   * Se comparan con JSON.stringify porque los valores llegan como Decimal,
   * Date u objetos anidados: `!==` los daría todos por distintos al comparar
   * referencias, y la bitácora se llenaría de campos que nadie tocó.
   */
  private diff(oldValue: unknown, newValue: unknown): string[] {
    if (!this.isRecord(oldValue) || !this.isRecord(newValue)) return [];

    const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    const changed: string[] = [];

    for (const key of keys) {
      if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === "object" && value !== null && !Array.isArray(value)
    );
  }

  /**
   * Normaliza a JSON serializable. Los Decimal y Date no sobreviven tal cual
   * a una columna Json.
   */
  private toJson(value: unknown): object | undefined {
    if (value === undefined || value === null) return undefined;
    return JSON.parse(JSON.stringify(value)) as object;
  }
}
