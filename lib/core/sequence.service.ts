import { prisma, type PrismaExecutor } from "@/lib/prisma";

/**
 * Generador de folios correlativos.
 *
 * Dos rollos dados de alta al mismo tiempo desde dos celulares NO pueden
 * recibir el mismo folio. Por eso el contador se incrementa con `increment`
 * de Prisma, que se traduce a `SET next = next + 1` en la propia base: la
 * lectura y la escritura ocurren en una sola sentencia y Postgres serializa
 * los accesos concurrentes a esa fila.
 *
 * Recibe el executor por constructor para poder correr DENTRO de la
 * transacción que abrió el servicio: si la operación se revierte, el folio
 * consumido se revierte con ella y no quedan huecos en la serie.
 */
export class SequenceService {
  private readonly db: PrismaExecutor;

  constructor(db: PrismaExecutor = prisma) {
    this.db = db;
  }

  /**
   * Entrega el siguiente folio de la serie. Formato: `PREFIJO-AÑO-00001`.
   *
   * @param seriesKey  Llave de la serie (LOT, RECEIPT, MOVEMENT…).
   * @param prefix     Prefijo visible (R, REC, MOV…).
   * @param padding    Dígitos del consecutivo, rellenados con ceros.
   */
  async next(seriesKey: string, prefix: string, padding = 5): Promise<string> {
    const year = new Date().getFullYear();
    const fullPrefix = `${prefix}-${year}`;

    // upsert + increment: crea la serie la primera vez y a partir de ahí
    // incrementa de forma atómica. Devuelve la fila YA incrementada, así que
    // el consecutivo que se acaba de apartar es `next - 1`.
    const sequence = await this.db.sequence.upsert({
      where: { key: seriesKey },
      update: { next: { increment: 1 } },
      create: { key: seriesKey, prefix: fullPrefix, next: 2, padding },
    });

    // Al cambiar el año la numeración vuelve a empezar: los folios son
    // correlativos POR AÑO, no desde que se instaló el sistema.
    if (sequence.prefix !== fullPrefix) {
      await this.db.sequence.update({
        where: { key: seriesKey },
        data: { prefix: fullPrefix, next: 2 },
      });
      return this.format(fullPrefix, 1, sequence.padding);
    }

    const consecutive = sequence.next - 1;
    return this.format(fullPrefix, consecutive, sequence.padding);
  }

  /**
   * Aparta `count` números seguidos de una serie SIN año ni prefijo.
   *
   * Para contadores que no son folios —el número de ítem de lo que se manda
   * por correo— y que siguen corriendo de un año al siguiente. `firstValue`
   * es por dónde arranca la serie la primera vez: se venía numerando a mano y
   * el sistema continúa donde se quedó el papel.
   *
   * Mismo `increment` atómico que `next()`: dos envíos simultáneos nunca
   * reciben el mismo número.
   */
  async reserveNumbers(
    seriesKey: string,
    count: number,
    firstValue: number,
  ): Promise<number[]> {
    if (count <= 0) return [];

    const sequence = await this.db.sequence.upsert({
      where: { key: seriesKey },
      update: { next: { increment: count } },
      create: { key: seriesKey, prefix: "", next: firstValue + count, padding: 0 },
    });

    const first = sequence.next - count;
    return Array.from({ length: count }, (_, index) => first + index);
  }

  /** Sólo consulta cuál sería el próximo folio. No aparta nada. */
  async peek(seriesKey: string, prefix: string, padding = 5): Promise<string> {
    const year = new Date().getFullYear();
    const fullPrefix = `${prefix}-${year}`;
    const sequence = await this.db.sequence.findUnique({
      where: { key: seriesKey },
    });

    if (!sequence || sequence.prefix !== fullPrefix) {
      return this.format(fullPrefix, 1, padding);
    }
    return this.format(fullPrefix, sequence.next, sequence.padding);
  }

  private format(prefix: string, consecutive: number, padding: number): string {
    return `${prefix}-${String(consecutive).padStart(padding, "0")}`;
  }
}
