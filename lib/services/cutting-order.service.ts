import type {
  CuttingBatch,
  CuttingOrder,
  CuttingOrderComment,
} from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import { cutBatchLabel } from "@/lib/constants/labels";
import type {
  BatchProgressInput,
  CuttingBatchInput,
  CuttingOrderInput,
  CuttingProgressInput,
  OrderCommentInput,
} from "@/lib/validations/cutting-order.schema";
import { BaseService } from "./base.service";
import { DocumentService } from "./document.service";

/** La transacción que reparte `BaseService`. */
type Tx = Parameters<Parameters<BaseService["transaction"]>[0]>[0];

/**
 * Órdenes de corte: qué pidió el cliente y cómo va el corte.
 *
 * El pedido se captura una vez y NO se toca: es la referencia contra la que se
 * mide todo lo demás. El avance se registra aparte, entrada por entrada, para
 * poder responder "cuánto falta" y también "cuándo se atoró esta orden".
 */
export class CuttingOrderService extends BaseService {
  async create(input: CuttingOrderInput): Promise<CuttingOrder> {
    return this.transaction(async (tx) => {
      const code = await this.sequencesWith(tx).next(
        "PRODUCTION_ORDER",
        "PO",
        4,
      );

      const order = await tx.cuttingOrder.create({
        data: {
          code,
          clientId: input.clientId,
          materialId: input.materialId,
          productionRunId: input.productionRunId,
          folderId: input.folderId,
          description: input.description,
          reference: input.reference,
          orderedAt: input.orderedAt ?? new Date(),
          dueDate: input.dueDate,
          notes: input.notes,
          cutFabricText: input.cutFabricText,
          cutPattern: input.cutPattern,
          cutVersion: input.cutVersion,
          cutVersionNotes: input.cutVersionNotes,
          cutNotes: input.cutNotes,
          createdById: this.context.userId,
          lines: {
            create: input.lines.map((line, index) => ({
              sizeId: line.sizeId,
              orderedQuantity: line.orderedQuantity,
              tagId: line.tagId,
              notes: line.notes,
              position: index,
            })),
          },
        },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: order.id,
        action: "CREATE",
        reference: code,
        newValue: { code, lines: input.lines.length },
        sensitivity: "LOW",
      });

      return order;
    });
  }

  /**
   * Corrige el pedido.
   *
   * Los renglones se reemplazan, pero SÓLO los que no tienen avance: borrar
   * uno que ya lleva piezas cortadas tiraría su historial, y con él la
   * respuesta a "cuándo se cortó esto".
   */
  async update(id: string, input: CuttingOrderInput): Promise<CuttingOrder> {
    return this.transaction(async (tx) => {
      const current = await tx.cuttingOrder.findUnique({
        where: { id },
        include: { lines: { include: { _count: { select: { progress: true } } } } },
      });
      if (!current) throw new NotFoundError("la orden", id);

      if (current.status === "CANCELLED") {
        throw new BusinessRuleError(
          `La orden ${current.code} está cancelada y no se puede editar.`,
        );
      }

      const withProgress = current.lines.filter(
        (line) => line._count.progress > 0,
      );
      /* Se empareja por `id`, no por `sizeId`: una talla ahora puede repetirse
         en dos renglones, así que el tamaño ya no identifica cuál renglón es
         cuál. El id es el único dato que sigue siendo único por fila. */
      const keptIds = new Set(withProgress.map((line) => line.id));

      const removed = input.lines.length
        ? withProgress.filter(
            (line) => !input.lines.some((next) => next.id === line.id),
          )
        : withProgress;

      if (removed.length > 0) {
        throw new BusinessRuleError(
          `No se pueden quitar tallas que ya tienen avance capturado. Registra un avance negativo si el conteo estaba mal.`,
        );
      }

      // Los renglones sin avance se borran y se recrean; los que ya llevan
      // corte sólo se actualizan, conservando su historial.
      await tx.cuttingOrderLine.deleteMany({
        where: { orderId: id, id: { notIn: [...keptIds] } },
      });

      for (const [index, line] of input.lines.entries()) {
        const existing = line.id
          ? withProgress.find((kept) => kept.id === line.id)
          : undefined;

        if (existing) {
          await tx.cuttingOrderLine.update({
            where: { id: existing.id },
            data: {
              orderedQuantity: line.orderedQuantity,
              tagId: line.tagId,
              notes: line.notes,
              position: index,
            },
          });
          continue;
        }

        await tx.cuttingOrderLine.create({
          data: {
            orderId: id,
            sizeId: line.sizeId,
            orderedQuantity: line.orderedQuantity,
            tagId: line.tagId,
            notes: line.notes,
            position: index,
          },
        });
      }

      const order = await tx.cuttingOrder.update({
        where: { id },
        data: {
          clientId: input.clientId,
          materialId: input.materialId,
          productionRunId: input.productionRunId,
          /* `?? null` y no `input.folderId` a secas: si el usuario vacía el
             selector llega `undefined`, y Prisma ignora undefined —la orden
             se quedaría en la carpeta de la que se acaba de sacar. */
          folderId: input.folderId ?? null,
          description: input.description,
          reference: input.reference,
          orderedAt: input.orderedAt ?? current.orderedAt,
          dueDate: input.dueDate,
          notes: input.notes,
          /* `?? null` por la misma razón que la carpeta: vaciar el molde o la
             versión llega como undefined y Prisma lo ignoraría, dejando el
             dato viejo en una orden que el usuario acaba de limpiar. */
          cutFabricText: input.cutFabricText ?? null,
          cutPattern: input.cutPattern ?? null,
          cutVersion: input.cutVersion ?? null,
          cutVersionNotes: input.cutVersionNotes ?? null,
          cutNotes: input.cutNotes,
        },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: id,
        action: "UPDATE",
        reference: order.code,
        oldValue: { lines: current.lines.length },
        newValue: { lines: input.lines.length },
        sensitivity: "LOW",
      });

      return order;
    });
  }

  /**
   * Abre el siguiente corte de una orden.
   *
   * El número es correlativo DENTRO de la orden y se calcula aquí, en la
   * transacción: el piso dice "el segundo corte de esta orden", nunca "el
   * corte 4,712", así que no va por `SequenceService`. El `@@unique(orderId,
   * number)` del esquema es la red: si dos personas abren corte a la vez, una
   * de las dos choca contra el índice en vez de crear dos "2º corte".
   */
  async openBatch(input: CuttingBatchInput): Promise<CuttingBatch> {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: input.orderId },
        select: { id: true, code: true, status: true },
      });
      if (!order) throw new NotFoundError("la orden", input.orderId);

      if (order.status === "CANCELLED") {
        throw new BusinessRuleError(`La orden ${order.code} está cancelada.`);
      }

      const batch = await this.createBatch(tx, input.orderId, input.label, input.notes);

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: order.id,
        action: "UPDATE",
        reference: order.code,
        newValue: { corteAbierto: batch.number, nombre: input.label },
        sensitivity: "LOW",
      });

      return batch;
    });
  }

  /**
   * Registra que se cortaron N piezas de una talla, dentro de un corte.
   *
   * El total de la talla se recalcula sumando su bitácora y NO incrementando
   * el número guardado: si dos personas capturan avance a la vez, sumar sobre
   * un valor leído antes perdería uno de los dos. Es la misma razón por la que
   * el saldo de un rollo se recalcula y no se acumula a ciegas.
   */
  async addProgress(input: CuttingProgressInput) {
    return this.transaction(async (tx) => {
      const line = await tx.cuttingOrderLine.findUnique({
        where: { id: input.lineId },
        include: { order: true, size: { select: { code: true } } },
      });
      if (!line) throw new NotFoundError("el renglón", input.lineId);

      if (line.order.status === "CANCELLED") {
        throw new BusinessRuleError(
          `La orden ${line.order.code} está cancelada.`,
        );
      }

      const batch = await this.requireBatch(tx, input.batchId, line.orderId);

      await tx.cuttingProgress.create({
        data: {
          lineId: input.lineId,
          batchId: batch.id,
          quantity: input.quantity,
          notes: input.notes,
          userId: this.context.userId,
        },
      });

      const cut = await this.recalculateLine(tx, input.lineId, line.size.code);

      await this.syncStatus(tx, line.orderId);

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: line.orderId,
        action: "UPDATE",
        reference: `${line.order.code} · talla ${line.size.code}`,
        newValue: {
          corte: batch.number,
          avance: input.quantity,
          acumulado: cut,
        },
        sensitivity: "LOW",
        reason: input.notes,
      });

      return { cutQuantity: cut };
    });
  }

  /**
   * Captura una tanda completa: un corte y varias tallas de un jalón.
   *
   * Es el flujo real del piso —se tiende, salen 5 de la 32 y 5 de la 45, y se
   * anota todo junto—, y por eso va en UNA transacción: media captura guardada
   * porque se cayó el WiFi a la mitad deja la orden diciendo una mentira.
   *
   * El estado de la orden se sincroniza UNA vez al final y no por talla: es el
   * mismo cálculo sobre los mismos renglones, y repetirlo por cada una sólo
   * gastaría viajes a la base.
   */
  async addBatchProgress(input: BatchProgressInput) {
    return this.transaction(async (tx) => {
      const lines = await tx.cuttingOrderLine.findMany({
        where: { id: { in: input.lines.map((line) => line.lineId) } },
        include: { order: true, size: { select: { code: true } } },
      });

      if (lines.length !== input.lines.length) {
        throw new NotFoundError("el renglón", "de la captura");
      }

      /* Todas las tallas tienen que ser de la MISMA orden, y de la que dice el
         formulario: el corte pertenece a una, y aceptar renglones de otra
         colgaría piezas de una tanda que nunca las cortó. */
      const orderIds = new Set(lines.map((line) => line.orderId));
      if (orderIds.size !== 1 || !orderIds.has(input.orderId)) {
        throw new BusinessRuleError(
          "Las tallas de una captura tienen que ser de la misma orden.",
        );
      }

      const orderId = input.orderId;

      const order = await tx.cuttingOrder.findUnique({
        where: { id: orderId },
        select: { code: true, status: true },
      });
      if (!order) throw new NotFoundError("la orden", orderId);

      if (order.status === "CANCELLED") {
        throw new BusinessRuleError(`La orden ${order.code} está cancelada.`);
      }

      /* Sin corte elegido se abre uno aquí mismo: así el corte nuevo y las
         piezas que lo estrenan se confirman o se revierten juntos, y no queda
         un corte vacío si la captura falla. */
      const batch = input.batchId
        ? await this.requireBatch(tx, input.batchId, orderId)
        : await this.createBatch(tx, orderId, input.newBatchLabel);

      const byId = new Map(lines.map((line) => [line.id, line]));
      let total = 0;

      for (const entry of input.lines) {
        /* El `!` es seguro por el conteo de arriba: si algún id no existiera
           —o viniera repetido— `findMany` habría devuelto menos renglones de
           los que pide la captura y ya se habría lanzado NotFoundError. */
        const line = byId.get(entry.lineId)!;

        await tx.cuttingProgress.create({
          data: {
            lineId: entry.lineId,
            batchId: batch.id,
            quantity: entry.quantity,
            notes: input.notes,
            userId: this.context.userId,
          },
        });

        await this.recalculateLine(tx, entry.lineId, line.size.code);
        total += entry.quantity;
      }

      await this.syncStatus(tx, orderId);

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: orderId,
        action: "UPDATE",
        reference: `${order.code} · ${batch.number}º corte`,
        newValue: {
          corte: batch.number,
          tallas: input.lines.length,
          piezas: total,
        },
        sensitivity: "LOW",
        reason: input.notes,
      });

      return { batchId: batch.id, pieces: total, sizes: input.lines.length };
    });
  }

  /**
   * Crea el corte con el siguiente número de la orden.
   *
   * Privado y con `tx` explícito porque lo usan dos caminos —abrir un corte a
   * mano y capturar una tanda en uno nuevo— y ambos tienen que numerarlo
   * dentro de SU transacción. Llamar a `openBatch()` desde adentro abriría una
   * segunda transacción, y Postgres no anida.
   */
  private async createBatch(
    tx: Tx,
    orderId: string,
    label?: string,
    notes?: string,
  ) {
    const last = await tx.cuttingBatch.findFirst({
      where: { orderId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    return tx.cuttingBatch.create({
      data: {
        orderId,
        number: (last?.number ?? 0) + 1,
        label,
        notes,
        createdById: this.context.userId,
      },
    });
  }

  /** El corte, comprobando que de verdad sea de esta orden. */
  private async requireBatch(tx: Tx, batchId: string, orderId: string) {
    const batch = await tx.cuttingBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundError("el corte", batchId);

    if (batch.orderId !== orderId) {
      throw new BusinessRuleError(
        "Ese corte es de otra orden. Elige uno de esta.",
      );
    }

    return batch;
  }

  /**
   * Recalcula el acumulado de una talla desde su bitácora y lo guarda.
   *
   * Suma el log en vez de incrementar el número guardado: dos capturas
   * simultáneas sobre un valor leído antes perderían una de las dos.
   */
  private async recalculateLine(tx: Tx, lineId: string, sizeCode: string) {
    const total = await tx.cuttingProgress.aggregate({
      where: { lineId },
      _sum: { quantity: true },
    });
    const cut = total._sum.quantity ?? 0;

    /* Un avance no puede dejar el total en negativo: sería un corte que se
       deshizo más veces de las que se hizo, y sólo puede ser un error de
       captura. */
    if (cut < 0) {
      throw new BusinessRuleError(
        `El avance dejaría la talla ${sizeCode} en negativo.`,
      );
    }

    await tx.cuttingOrderLine.update({
      where: { id: lineId },
      data: { cutQuantity: cut },
    });

    return cut;
  }

  /** Cancela la orden. No se borra: su historial de corte debe conservarse. */
  async cancel(id: string, reason: string): Promise<CuttingOrder> {
    return this.transaction(async (tx) => {
      const current = await tx.cuttingOrder.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la orden", id);

      const order = await tx.cuttingOrder.update({
        where: { id },
        data: { status: "CANCELLED", closedAt: new Date() },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: id,
        action: "DELETE",
        reference: current.code,
        oldValue: { status: current.status },
        newValue: { status: "CANCELLED" },
        sensitivity: "MEDIUM",
        reason,
      });

      return order;
    });
  }

  /**
   * Borra la orden, con su desglose y su historial de cortes.
   *
   * No sustituye a cancelar, que es otra cosa: una orden cancelada conserva el
   * papel —qué se alcanzó a cortar antes de que se cayera— y se sigue
   * consultando. Borrar no deja nada, y por eso es para el otro caso: la orden
   * capturada por error, que no es historia sino basura, y que dejada como
   * cancelada para siempre le estorba al piso.
   *
   * Los renglones y sus avances se van por cascada del esquema. Lo único que
   * sobrevive es el AuditLog —quién la borró, cuándo, por qué y qué se llevó
   * por delante—, que es append-only justo para esto.
   *
   * El motivo es OBLIGATORIO: es una acción HIGH y el AuditLog no acepta una
   * sin explicación. Es además lo único que va a quedar para contestar por qué
   * ya no está esa orden, porque de la orden misma no queda nada.
   */
  async remove(id: string, reason: string): Promise<CuttingOrder> {
    return this.transaction(async (tx) => {
      const current = await tx.cuttingOrder.findUnique({
        where: { id },
        include: {
          lines: {
            select: {
              orderedQuantity: true,
              cutQuantity: true,
              _count: { select: { progress: true } },
            },
          },
        },
      });
      if (!current) throw new NotFoundError("la orden", id);

      const ordered = current.lines.reduce((s, l) => s + l.orderedQuantity, 0);
      const cut = current.lines.reduce((s, l) => s + l.cutQuantity, 0);
      const entries = current.lines.reduce((s, l) => s + l._count.progress, 0);

      const order = await tx.cuttingOrder.delete({ where: { id } });

      /* Se guarda el RESUMEN de lo que se llevo y no solo el folio: cuando
         alguien pregunte por qué una orden ya no está, el registro tiene que
         poder decir si se borró un papel vacío o uno con 300 piezas cortadas. */
      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: id,
        action: "DELETE",
        reference: current.code,
        oldValue: {
          estado: current.status,
          tallas: current.lines.length,
          pedidas: ordered,
          cortadas: cut,
          avances: entries,
        },
        sensitivity: "HIGH",
        reason,
      });

      return order;
    });
  }

  /**
   * Manda una orden ya cortada a Salidas como BORRADOR.
   *
   * Existe porque el flujo real era capturar dos veces lo mismo: la orden ya
   * tiene el cliente, la tela y el desglose talla por talla, y para darle
   * salida había que volver a teclearlo todo. Aquí se copia lo que coincide y
   * el resto —los rollos que se descuentan, quién recibe— se completa en el
   * vale, que es donde vive esa información.
   *
   * Se copia lo CORTADO y no lo pedido: lo que sale por la puerta son las
   * prendas que ya existen. Una talla sin avance no tiene nada que entregar,
   * así que no viaja; si luego se corta, se manda otro vale.
   *
   * Nace en DRAFT y sin renglones de rollo, que es un estado válido para una
   * salida: lo que se entrega son prendas ya cortadas, no tela por descontar.
   * El vale NO se aplica aquí —eso mueve inventario y es un acto deliberado
   * del auxiliar— ni la orden cambia de estado: mandar el papel al taller no
   * es cortar más.
   *
   * @param batchId Manda UN corte en vez de la orden entera.
   *
   * El taller no entrega la orden completa de una vez: entrega el primer
   * tendido, sigue cortando y entrega el segundo. Sin esto había que mandar
   * todo lo cortado hasta la fecha, y el segundo vale volvía a incluir lo que
   * ya se había llevado el primero.
   */
  async sendToIssue(
    orderId: string,
    batchId?: string,
  ): Promise<{ id: string; code: string }> {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              sizeId: true,
              cutQuantity: true,
              tagId: true,
              notes: true,
            },
          },
        },
      });

      if (!order) throw new NotFoundError("la orden", orderId);

      if (order.status === "CANCELLED") {
        throw new BusinessRuleError(
          "Una orden cancelada no puede mandarse a salidas.",
        );
      }

      const batch = batchId
        ? await this.loadSendableBatch(tx, orderId, batchId)
        : null;

      const cutLines = batch
        ? await this.batchCutLines(tx, order.lines, batch.id)
        : order.lines
            .filter((line) => line.cutQuantity > 0)
            .map((line) => ({
              sizeId: line.sizeId,
              quantity: line.cutQuantity,
              // Un bulto por talla: cuántos son de verdad se sabe al empacar, y
              // el auxiliar lo corrige en el vale. Poner cero sería mentir.
              bundles: 1,
              tagId: line.tagId ?? undefined,
              notes: line.notes ?? undefined,
            }));

      if (cutLines.length === 0) {
        throw new BusinessRuleError(
          batch
            ? `${cutBatchLabel(batch.number, batch.label)} no tiene piezas capturadas que entregar.`
            : "Esta orden todavía no tiene piezas cortadas que entregar.",
        );
      }

      /* El vale se crea por DocumentService y no con un `create` suelto: es la
         única puerta a los documentos y la que genera el folio de la serie
         OUT. Se le pasa `tx` para que el borrador y su auditoría se confirmen
         junto con esta transacción. */
      const document = await new DocumentService(this.context, tx).create({
        type: "ISSUE",
        date: new Date(),
        clientId: order.clientId ?? undefined,
        productionRunId: order.productionRunId ?? undefined,
        /* La liga de verdad con la orden, aparte de la referencia de papel:
           es lo que después deja a la ficha decir "esta orden ya salió y el
           vale sigue en pie", y lo que impide mandar dos veces el mismo corte. */
        cuttingOrderId: order.id,
        cuttingBatchId: batch?.id,
        // De dónde salió, en el papel que firma el taller.
        concept: order.description ?? undefined,
        reference: order.reference ?? order.code,
        handedOverBy: undefined,
        receivedBy: undefined,
        notes: order.notes ?? undefined,
        // Sin rollos: el vale sale con puro desglose y el auxiliar agrega la
        // tela a descontar si hace falta.
        lines: [],
        cutLines,
        /* El encabezado viaja COMPLETO desde la orden: es donde se supo la
           prenda, el molde y la versión. Antes sólo cruzaban la descripción y
           la tela, y el auxiliar tenía que recapturar el resto en el vale
           mirando el papel de la orden. */
        cutDescription: order.description ?? undefined,
        cutFabricId: order.materialId ?? undefined,
        cutFabricText: order.cutFabricText ?? undefined,
        cutPattern: order.cutPattern ?? undefined,
        cutVersion: order.cutVersion ?? undefined,
        cutVersionNotes: order.cutVersionNotes ?? undefined,
        cutNotes: order.cutNotes,
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: order.id,
        action: "UPDATE",
        reference: order.code,
        newValue: {
          sentToIssue: document.code,
          cutLines: cutLines.length,
          batch: batch ? batch.number : null,
        },
        sensitivity: "LOW",
      });

      return { id: document.id, code: document.code };
    });
  }

  /**
   * El corte que se va a mandar, si de verdad se puede mandar.
   *
   * Bloquea el reenvío cuando ese corte ya tiene un vale VIVO —borrador o
   * aplicado—. Mandarlo dos veces entregaría las mismas prendas dos veces en
   * el papel, y la cuenta de lo que anda afuera dejaría de cuadrar sin que
   * nadie se enterara hasta el conteo. Un vale cancelado no estorba: cancelar
   * es justo cómo se deshace un envío equivocado.
   */
  private async loadSendableBatch(
    tx: Tx,
    orderId: string,
    batchId: string,
  ) {
    const batch = await tx.cuttingBatch.findUnique({
      where: { id: batchId },
      select: { id: true, orderId: true, number: true, label: true },
    });

    if (!batch) throw new NotFoundError("el corte", batchId);

    // El corte llega de la URL: sin esto se podría colgar el corte de una
    // orden al vale de otra.
    if (batch.orderId !== orderId) {
      throw new BusinessRuleError("Ese corte no pertenece a esta orden.");
    }

    const live = await tx.inventoryDocument.findFirst({
      where: { cuttingBatchId: batchId, status: { not: "CANCELLED" } },
      select: { code: true, status: true },
      orderBy: { createdAt: "desc" },
    });

    if (live) {
      const state = live.status === "DRAFT" ? "en borrador" : "aplicada";
      throw new BusinessRuleError(
        `${cutBatchLabel(batch.number, batch.label)} ya salió en ${live.code} (${state}). Cancela esa salida si quieres volver a mandarlo.`,
      );
    }

    return batch;
  }

  /**
   * Lo que dio UN corte, talla por talla.
   *
   * Se suman las capturas de ese corte y no se lee `cutQuantity`, que es el
   * acumulado de toda la orden: usarlo haría que el segundo vale volviera a
   * incluir lo que ya se llevó el primero.
   *
   * Las tallas con neto cero o negativo se caen: un corte puede llevar una
   * corrección que descuenta piezas mal contadas, y mandar "-8 piezas" en un
   * vale no significa nada para el taller que lo firma.
   */
  private async batchCutLines(
    tx: Tx,
    lines: { id: string; sizeId: string; tagId: string | null; notes: string | null }[],
    batchId: string,
  ) {
    const grouped = await tx.cuttingProgress.groupBy({
      by: ["lineId"],
      where: { batchId },
      _sum: { quantity: true },
    });

    const byLine = new Map(
      grouped.map((row) => [row.lineId, row._sum.quantity ?? 0]),
    );

    // Se recorren las TALLAS y no el agrupado para respetar el orden del
    // pedido: el vale se lee contra la orden, talla por talla y en su orden.
    return lines
      .map((line) => ({ line, quantity: byLine.get(line.id) ?? 0 }))
      .filter(({ quantity }) => quantity > 0)
      .map(({ line, quantity }) => ({
        sizeId: line.sizeId,
        quantity,
        bundles: 1,
        tagId: line.tagId ?? undefined,
        notes: line.notes ?? undefined,
      }));
  }

  /**
   * El estado se deriva del avance, no se elige a mano.
   *
   * Que alguien tenga que acordarse de marcar una orden como terminada es
   * garantía de que el tablero mienta: se calcula de lo que ya está capturado.
   */
  private async syncStatus(tx: Tx, orderId: string) {
    const lines = await tx.cuttingOrderLine.findMany({
      where: { orderId },
      select: { orderedQuantity: true, cutQuantity: true },
    });

    const ordered = lines.reduce((sum, l) => sum + l.orderedQuantity, 0);
    const cut = lines.reduce((sum, l) => sum + l.cutQuantity, 0);

    const status =
      cut === 0 ? "OPEN" : cut >= ordered ? "COMPLETED" : "IN_PROGRESS";

    await tx.cuttingOrder.update({
      where: { id: orderId },
      data: {
        status,
        // Se sella al terminar y se limpia si vuelve a abrirse por una
        // corrección: una fecha de cierre en una orden viva confunde.
        closedAt: status === "COMPLETED" ? new Date() : null,
      },
    });
  }

  /**
   * Agrega un comentario INTERNO a la orden.
   *
   * No toca `CuttingOrder.notes`: ese campo es parte del documento —se imprime
   * en la hoja que firma el taller y se copia al vale de salida— y estos
   * comentarios no pueden salir del edificio. Son la planeación de la oficina:
   * a qué taller va qué porcentaje, con quién se quedó de acuerdo.
   *
   * Se permite comentar una orden CANCELADA: explicar por qué se cayó es justo
   * cuando más falta hace tener dónde anotarlo.
   */
  async addComment(input: OrderCommentInput): Promise<CuttingOrderComment> {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: input.orderId },
        select: { id: true, code: true },
      });
      if (!order) throw new NotFoundError("la orden", input.orderId);

      const comment = await tx.cuttingOrderComment.create({
        data: {
          orderId: order.id,
          body: input.body,
          createdById: this.context.userId,
        },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: order.id,
        action: "UPDATE",
        reference: order.code,
        /* El TEXTO no se copia a la bitácora: son notas internas, y guardarlas
           ahí las dejaría vivas después de borrarlas —justo lo contrario de
           poder retirarlas—. Queda el rastro de que se agregó una. */
        newValue: { commentAdded: comment.id },
        sensitivity: "LOW",
      });

      return comment;
    });
  }

  /**
   * Retira un comentario interno.
   *
   * Se borra de verdad y no se marca: es una nota de trabajo, no un asiento
   * del kárdex. Lo que sí queda es el renglón de auditoría de que alguien la
   * retiró y cuándo.
   */
  async removeComment(id: string): Promise<void> {
    return this.transaction(async (tx) => {
      const comment = await tx.cuttingOrderComment.findUnique({
        where: { id },
        select: { id: true, orderId: true, order: { select: { code: true } } },
      });
      if (!comment) throw new NotFoundError("el comentario", id);

      await tx.cuttingOrderComment.delete({ where: { id } });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: comment.orderId,
        action: "UPDATE",
        reference: comment.order.code,
        oldValue: { commentRemoved: id },
        sensitivity: "LOW",
      });
    });
  }
}
