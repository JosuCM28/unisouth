import { prisma, type PrismaExecutor } from "@/lib/prisma";
import { AuditService, type AuditContext } from "@/lib/core/audit.service";
import { SequenceService } from "@/lib/core/sequence.service";

/**
 * Base de todos los servicios de dominio.
 *
 * Aquí viven las REGLAS DEL NEGOCIO. Un servicio valida, decide, abre
 * transacciones y deja rastro; el repositorio de abajo sólo guarda.
 *
 * ENCAPSULAMIENTO: `db`, `audit` y `sequences` son protected. Nadie fuera de
 * la jerarquía instancia los servicios auxiliares ni toca Prisma por su
 * cuenta; ésa es la garantía de que todo cambio queda auditado y de que
 * ningún folio se genera fuera de SequenceService.
 *
 * HERENCIA: todos los servicios extienden esta clase, así que todos reciben
 * el mismo contexto y saben transaccionar igual.
 */
export abstract class BaseService {
  protected readonly db: PrismaExecutor;
  protected readonly audit: AuditService;
  protected readonly sequences: SequenceService;
  protected readonly context: AuditContext;

  constructor(context: AuditContext = {}, db: PrismaExecutor = prisma) {
    this.context = context;
    this.db = db;
    this.audit = new AuditService(context, db);
    this.sequences = new SequenceService(db);
  }

  /**
   * Corre `work` dentro de una transacción.
   *
   * El callback recibe el executor transaccional para que TODO lo que ocurra
   * dentro —saldo, movimiento, folio, auditoría— se confirme o se revierta
   * junto. Es lo que impide que quede un movimiento sin su ajuste de saldo.
   *
   * Si ya se está dentro de una transacción no se abre otra: Postgres no
   * anida transacciones reales y hacerlo rompería el rollback.
   */
  protected async transaction<T>(
    work: (tx: PrismaExecutor) => Promise<T>,
  ): Promise<T> {
    if (!this.isRootClient(this.db)) {
      return work(this.db);
    }

    return this.db.$transaction(async (tx) => work(tx));
  }

  /**
   * AuditService atado al executor de la transacción en curso.
   *
   * `this.audit` usa el executor del constructor, así que una auditoría
   * escrita con él NO se revertiría si la transacción falla: quedaría el
   * registro de un cambio que nunca ocurrió. Dentro de `transaction()`
   * siempre se usa este helper.
   */
  protected auditWith(tx: PrismaExecutor): AuditService {
    return new AuditService(this.context, tx);
  }

  /** SequenceService atado a la transacción, por la misma razón. */
  protected sequencesWith(tx: PrismaExecutor): SequenceService {
    return new SequenceService(tx);
  }

  private isRootClient(
    db: PrismaExecutor,
  ): db is Extract<PrismaExecutor, { $transaction: unknown }> {
    return "$transaction" in db;
  }
}
