import type { OrderFolder } from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import { sumBundlePieces } from "@/lib/bundles";
import { toCutLines, type CutLineDraft } from "@/lib/cut-lines";
import { cutBatchLabel } from "@/lib/constants/labels";
import { OrderFolderRepository } from "@/lib/repositories/order-folder.repository";
import type {
  FolderWorkshopInput,
  OrderFolderInput,
} from "@/lib/validations/order-folder.schema";
import { BaseService } from "./base.service";
import { DocumentService } from "./document.service";
import { GarmentShipmentService } from "./garment-shipment.service";

/** Un corte que no viajó, y por qué. Se avisa; nunca se calla. */
export interface SkippedCut {
  orderCode: string;
  batch: string;
  issueCode: string;
}

/** Lo que dejó la salida global, para contárselo a quien la disparó. */
export interface FolderIssueResult {
  id: string;
  code: string;
  orders: number;
  pieces: number;
  skipped: SkippedCut[];
}

/** Lo que dejó el envío global a taller. */
export interface FolderShipmentResult {
  shipments: { code: string; orderCode: string; pieces: number }[];
  /** Órdenes sin nada cortado. No hay qué mandar de ellas todavía. */
  skipped: string[];
}

/**
 * Carpetas de pedido: agrupan varias órdenes de corte de un mismo pedido.
 *
 * La carpeta NO guarda cantidades. Todo lo que muestra —piezas pedidas,
 * cortadas, cuánto falta— sale de sumar sus órdenes. Guardar un total propio
 * abriría la puerta a que la carpeta diga una cosa y los papeles otra, que es
 * exactamente el problema que se quiere resolver.
 */
export class OrderFolderService extends BaseService {
  async create(input: OrderFolderInput): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const code = await this.sequencesWith(tx).next("ORDER_FOLDER", "PED", 4);

      const folder = await tx.orderFolder.create({
        data: {
          code,
          name: input.name,
          clientId: input.clientId,
          reference: input.reference,
          dueDate: input.dueDate,
          notes: input.notes,
          createdById: this.context.userId,
        },
      });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: folder.id,
        action: "CREATE",
        reference: code,
        newValue: { code, name: input.name },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  async update(id: string, input: OrderFolderInput): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const current = await tx.orderFolder.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la carpeta", id);

      const folder = await tx.orderFolder.update({
        where: { id },
        data: {
          name: input.name,
          clientId: input.clientId,
          reference: input.reference,
          dueDate: input.dueDate,
          notes: input.notes,
        },
      });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: id,
        action: "UPDATE",
        reference: current.code,
        oldValue: { name: current.name, clientId: current.clientId },
        newValue: { name: input.name, clientId: input.clientId },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  /**
   * Archiva el pedido para que deje de estorbar en la lista.
   *
   * Se exige que no queden órdenes con corte pendiente: archivar un pedido a
   * medias lo esconde del piso, y lo que no se ve no se corta. Si de verdad
   * ya no va, primero se cancelan sus órdenes.
   */
  async archive(id: string): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const current = await tx.orderFolder.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la carpeta", id);

      if (current.archivedAt) {
        throw new BusinessRuleError(`El pedido ${current.code} ya está archivado.`);
      }

      const pending = await tx.cuttingOrder.count({
        where: { folderId: id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      });

      if (pending > 0) {
        throw new BusinessRuleError(
          `El pedido ${current.code} todavía tiene ${pending} ${pending === 1 ? "orden abierta" : "órdenes abiertas"}. Termínalas o cancélalas antes de archivar.`,
        );
      }

      const folder = await tx.orderFolder.update({
        where: { id },
        data: { archivedAt: new Date() },
      });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: id,
        action: "UPDATE",
        reference: current.code,
        oldValue: { archivado: false },
        newValue: { archivado: true },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  /** Lo saca del archivo: el cliente volvió a pedir sobre el mismo pedido. */
  async unarchive(id: string): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const current = await tx.orderFolder.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("la carpeta", id);

      const folder = await tx.orderFolder.update({
        where: { id },
        data: { archivedAt: null },
      });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: id,
        action: "UPDATE",
        reference: current.code,
        oldValue: { archivado: true },
        newValue: { archivado: false },
        sensitivity: "LOW",
      });

      return folder;
    });
  }

  /**
   * Mueve una orden a una carpeta, o la deja suelta con `folderId` nulo.
   *
   * Es la operación que permite ordenar lo que ya estaba capturado sin volver
   * a teclearlo: las órdenes de antes de que existieran las carpetas se
   * acomodan desde la lista, una por una.
   */
  async moveOrder(orderId: string, folderId?: string) {
    return this.transaction(async (tx) => {
      const order = await tx.cuttingOrder.findUnique({
        where: { id: orderId },
        include: { folder: { select: { code: true } } },
      });
      if (!order) throw new NotFoundError("la orden", orderId);

      let target: { code: string; name: string } | null = null;

      if (folderId) {
        const folder = await tx.orderFolder.findUnique({
          where: { id: folderId },
          select: { code: true, name: true, archivedAt: true },
        });
        if (!folder) throw new NotFoundError("la carpeta", folderId);

        /* Meter una orden viva en un pedido archivado la escondería de la
           lista diaria sin que nadie lo note. */
        if (folder.archivedAt) {
          throw new BusinessRuleError(
            `El pedido ${folder.code} está archivado. Sácalo del archivo antes de moverle órdenes.`,
          );
        }

        target = { code: folder.code, name: folder.name };
      }

      const updated = await tx.cuttingOrder.update({
        where: { id: orderId },
        data: { folderId: folderId ?? null },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: orderId,
        action: "UPDATE",
        reference: order.code,
        oldValue: { pedido: order.folder?.code ?? null },
        newValue: { pedido: target?.code ?? null },
        sensitivity: "LOW",
      });

      return updated;
    });
  }

  /**
   * Borra la carpeta, y SÓLO si ya está vacía.
   *
   * Tirar la carpeta jamás puede tirar los papeles: por eso no se borra en
   * cascada. Pero dejar sueltas las órdenes de una carpeta borrada tampoco
   * sirve —se van al fondo de la lista general, sin el pedido que les daba
   * sentido, y ahí nadie las vuelve a encontrar—. Así que se exige vaciarla a
   * propósito: primero se borra o se mueve cada orden, y hasta entonces se va
   * la carpeta. Quien sólo quiere quitarla de en medio tiene Archivar.
   *
   * El `onDelete: SetNull` del esquema se queda como red: con esta regla ya no
   * llega a dispararse, pero si algún día se borra una carpeta por otro
   * camino, sus órdenes siguen sin irse con ella.
   */
  async remove(id: string): Promise<OrderFolder> {
    return this.transaction(async (tx) => {
      const current = await tx.orderFolder.findUnique({
        where: { id },
        include: { _count: { select: { orders: true } } },
      });
      if (!current) throw new NotFoundError("la carpeta", id);

      const orders = current._count.orders;

      if (orders > 0) {
        throw new BusinessRuleError(
          `El pedido ${current.code} todavía tiene ${orders} ${orders === 1 ? "orden" : "órdenes"}. Bórralas o muévelas a otro pedido antes de eliminarlo.`,
        );
      }

      const folder = await tx.orderFolder.delete({ where: { id } });

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: id,
        action: "DELETE",
        reference: current.code,
        oldValue: { name: current.name, ordenes: current._count.orders },
        sensitivity: "MEDIUM",
      });

      return folder;
    });
  }

  /**
   * LA SALIDA GLOBAL: un solo vale con lo cortado de todo el pedido.
   *
   * Llegan cinco órdenes del mismo cliente y el taller se lleva las prendas de
   * las cinco en el mismo viaje. Mandarlas orden por orden significa cinco
   * papeles para una sola entrega, cinco firmas y cinco folios que después hay
   * que cuadrar a mano contra un camión que se fue una vez.
   *
   * Se copia lo CORTADO, corte por corte y bulto por bulto: lo que sale por la
   * puerta son las prendas que ya existen, y el desglose se firma contra los
   * bultos de verdad. Una talla capturada en dos bultos de cuentas distintas
   * viaja en dos renglones, porque así se cuenta al recibirla.
   *
   * Los cortes que YA salieron —en su propio vale o en un global anterior— se
   * saltan y se avisan. Nunca se entregan dos veces en papel.
   *
   * Nace en DRAFT: aplicar mueve existencias y es un acto deliberado del
   * auxiliar, no un efecto de haber apretado este botón.
   */
  async sendToIssue(folderId: string): Promise<FolderIssueResult> {
    return this.transaction(async (tx) => {
      const folder = await tx.orderFolder.findUnique({
        where: { id: folderId },
      });
      if (!folder) throw new NotFoundError("el pedido", folderId);

      const orders = await new OrderFolderRepository(tx).findSendableCuts(
        folderId,
      );

      if (orders.length === 0) {
        throw new BusinessRuleError(
          `El pedido ${folder.code} no tiene órdenes vivas que mandar.`,
        );
      }

      this.requireSingleClient(folder.code, orders);

      const cutLines: CutLineDraft[] = [];
      const sentBatchIds: string[] = [];
      const skipped: SkippedCut[] = [];
      const sending = new Set<string>();

      for (const order of orders) {
        for (const batch of order.batches) {
          /* Los dos caminos por los que ya pudo salir. Basta uno vivo para
             que este corte no viaje: las prendas ya están en ese papel. */
          const live = batch.issues[0] ?? batch.folderIssues[0];

          if (live) {
            skipped.push({
              orderCode: order.code,
              batch: cutBatchLabel(batch.number, batch.label),
              issueCode: live.code,
            });
            continue;
          }

          const lines = toCutLines(order.lines, batch.entries);
          if (lines.length === 0) continue;

          cutLines.push(...lines);
          sentBatchIds.push(batch.id);
          sending.add(order.code);
        }
      }

      if (cutLines.length === 0) {
        throw new BusinessRuleError(
          skipped.length > 0
            ? `Todo lo cortado del pedido ${folder.code} ya salió en ${uniqueCodes(skipped).join(", ")}. Cancela esas salidas si necesitas volver a mandarlo.`
            : `El pedido ${folder.code} todavía no tiene piezas cortadas que entregar.`,
        );
      }

      const document = await new DocumentService(this.context, tx).create({
        type: "ISSUE",
        date: new Date(),
        /* Ya se validó que es uno solo: con dos dueños distintos ni se llega
           aquí, porque un vale con tela de dos clientes rompe la regla de que
           nada se surte cruzado. */
        clientId: sharedValue(orders, (o) => o.clientId),
        productionRunId: sharedValue(orders, (o) => o.productionRunId),
        // Ni orden ni corte sueltos: este vale es del PEDIDO, y `sentBatchIds`
        // es lo que después impide que esos cortes vuelvan a salir.
        cuttingOrderId: undefined,
        cuttingBatchId: undefined,
        orderFolderId: folder.id,
        sentBatchIds,
        concept: folder.name,
        // El número que el cliente dice por teléfono, y si no, el del pedido.
        reference: folder.reference ?? folder.code,
        handedOverBy: undefined,
        receivedBy: undefined,
        notes: folderNotes(folder.code, sending.size, folder.notes),
        // Sin rollos: lo que sale son prendas ya cortadas, no tela.
        lines: [],
        cutLines: mergeCutLines(cutLines, sizeOrderOf(orders)),
        /* Del encabezado sólo viaja lo que TODAS comparten. Heredar el molde
           de una de cinco órdenes pondría en el papel un dato que es falso
           para las otras cuatro, y ese papel se corta. */
        cutDescription: sharedValue(orders, (o) => o.description) ?? folder.name,
        cutFabricId: sharedValue(orders, (o) => o.materialId),
        cutFabricText: sharedValue(orders, (o) => o.cutFabricText),
        cutPattern: sharedValue(orders, (o) => o.cutPattern),
        cutVersion: sharedValue(orders, (o) => o.cutVersion),
        cutVersionNotes: sharedValue(orders, (o) => o.cutVersionNotes),
        cutNotes: folderCutNotes(orders),
      });

      const pieces = sumBundlePieces(cutLines);

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: folder.id,
        action: "UPDATE",
        reference: folder.code,
        newValue: {
          vale: document.code,
          ordenes: [...sending],
          cortes: sentBatchIds.length,
          piezas: pieces,
          saltados: skipped.length,
        },
        sensitivity: "LOW",
      });

      return {
        id: document.id,
        code: document.code,
        orders: sending.size,
        pieces,
        skipped,
      };
    });
  }

  /**
   * EL ENVÍO GLOBAL A TALLER: todo el pedido sale al mismo proceso de un jalón.
   *
   * Nace un envío POR ORDEN y no uno solo para el pedido, a propósito. Los
   * retornos del taller se cuentan contra la orden —es ahí donde vive el
   * tablero de "cuánto mandé y cuánto volvió"— y un envío que no supiera de
   * qué orden salió cada talla dejaría esa cuenta sin contra qué cuadrarse.
   * Lo global es la CAPTURA: taller, proceso, partes y fecha se eligen una vez
   * y los papeles nacen juntos, cada uno con su folio.
   *
   * A diferencia de la salida global, esto SÍ se puede repetir. Lo que sale a
   * un taller son paneles, no la prenda: las mismas piezas van a bordado y
   * después a armado, y cada etapa lleva su propia cuenta. Un seguro de "ya
   * salió" aquí impediría el segundo proceso, que es trabajo normal.
   *
   * Las órdenes sin nada cortado se saltan y se avisan: no hay qué mandar.
   */
  async sendToWorkshop(
    folderId: string,
    input: FolderWorkshopInput,
  ): Promise<FolderShipmentResult> {
    return this.transaction(async (tx) => {
      const folder = await tx.orderFolder.findUnique({
        where: { id: folderId },
      });
      if (!folder) throw new NotFoundError("el pedido", folderId);

      const orders = await new OrderFolderRepository(tx).findSendableCuts(
        folderId,
      );

      if (orders.length === 0) {
        throw new BusinessRuleError(
          `El pedido ${folder.code} no tiene órdenes vivas que mandar.`,
        );
      }

      const shipments: FolderShipmentResult["shipments"] = [];
      const skipped: string[] = [];

      /* El servicio de envíos recibe ESTA transacción: los N envíos y sus N
         vales se confirman juntos o no queda ninguno. Un pedido que se fue a
         medias al taller es peor que uno que no se fue. */
      const service = new GarmentShipmentService(this.context, tx);

      for (const order of orders) {
        /* TODO lo cortado de la orden, sin importar qué ya salió: aquí no hay
           seguro de doble envío porque mandar las mismas piezas a la siguiente
           etapa es el trabajo normal del taller. */
        const entries = order.batches.flatMap((batch) => batch.entries);
        const lines = toCutLines(order.lines, entries);

        if (lines.length === 0) {
          skipped.push(order.code);
          continue;
        }

        const shipment = await service.create({
          orderId: order.id,
          workshopId: input.workshopId,
          stageId: input.stageId,
          sentAt: input.sentAt,
          dueDate: input.dueDate,
          parts: input.parts,
          reference: input.reference,
          notes: input.notes,
          lines: lines.map((line) => ({
            sizeId: line.sizeId,
            sentQuantity: line.quantity,
            bundles: line.bundles,
            // El color con el que salió de la mesa: `toCutLines` ya lo
            // resolvió —el del bulto, o el del renglón si no se capturó—.
            tagId: line.tagId,
            notes: line.notes,
          })),
        });

        shipments.push({
          code: shipment.code,
          orderCode: order.code,
          pieces: sumBundlePieces(lines),
        });
      }

      if (shipments.length === 0) {
        throw new BusinessRuleError(
          `El pedido ${folder.code} todavía no tiene piezas cortadas que mandar al taller.`,
        );
      }

      await this.auditWith(tx).record({
        entity: "OrderFolder",
        entityId: folder.id,
        action: "UPDATE",
        reference: folder.code,
        newValue: {
          envios: shipments.map((s) => s.code),
          ordenes: shipments.length,
          piezas: shipments.reduce((sum, s) => sum + s.pieces, 0),
          saltadas: skipped.length,
        },
        sensitivity: "LOW",
      });

      return { shipments, skipped };
    });
  }

  /**
   * Un pedido, un dueño.
   *
   * La regla más sagrada del almacén: la tela es del cliente que manda a
   * maquilar y jamás se surte para la producción de otro. Un vale global con
   * órdenes de dos clientes sería exactamente eso, en un solo papel, y con la
   * firma de quien lo recibe encima.
   */
  private requireSingleClient(
    folderCode: string,
    orders: { clientId: string | null }[],
  ) {
    const clients = new Set(orders.map((order) => order.clientId ?? "—"));
    if (clients.size <= 1) return;

    throw new BusinessRuleError(
      `El pedido ${folderCode} tiene órdenes de ${clients.size} clientes distintos y no puede salir en un solo vale. Mándalas por separado desde cada orden.`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Ayudas del vale global
// ═══════════════════════════════════════════════════════════════════════════

/**
 * El valor que TODAS las órdenes comparten, o nada.
 *
 * Un encabezado que hereda el molde de la primera orden pone en el papel un
 * dato falso para las demás, y ese papel es contra el que se corta. Vacío el
 * auxiliar lo escribe; equivocado, nadie lo revisa.
 */
function sharedValue<T, V>(
  orders: T[],
  pick: (order: T) => V | null,
): V | undefined {
  const [head, ...rest] = orders;
  if (!head) return undefined;

  const value = pick(head);
  if (value === null || value === undefined) return undefined;

  return rest.every((order) => pick(order) === value) ? value : undefined;
}

/**
 * Las notas de corte de todas las órdenes, cada una con su folio delante.
 *
 * Van numeradas en el papel para que el taller las vaya palomeando, y sin el
 * folio de la orden una instrucción que sólo aplica a una de cinco se leería
 * como si aplicara a todo el pedido.
 */
function folderCutNotes(
  orders: { code: string; cutNotes: string[] }[],
): string[] {
  return orders.flatMap((order) =>
    order.cutNotes.map((note) => `${order.code}: ${note}`),
  );
}

/** El pie del vale: de dónde salió y cuántas órdenes trae. */
function folderNotes(
  code: string,
  orders: number,
  notes: string | null,
): string {
  const head = `Pedido ${code} · ${orders} ${orders === 1 ? "orden" : "órdenes"}`;
  return notes ? `${head}\n${notes}` : head;
}

/** Los vales en los que ya salió lo que se saltó, sin repetirlos. */
function uniqueCodes(skipped: SkippedCut[]): string[] {
  return [...new Set(skipped.map((cut) => cut.issueCode))];
}

/** Dónde cae cada talla en el catálogo, para ordenar el desglose del vale. */
function sizeOrderOf(
  orders: { lines: { sizeId: string; size: { order: number } }[] }[],
): Map<string, number> {
  const positions = new Map<string, number>();

  for (const order of orders) {
    for (const line of order.lines) {
      positions.set(line.sizeId, line.size.order);
    }
  }

  return positions;
}

/**
 * Junta los renglones idénticos y ordena el desglose por talla.
 *
 * Cinco órdenes de la misma prenda dan cinco renglones de "talla 38, 30 piezas
 * por bulto" que en el camión son cinco bultos iguales: en el papel son un
 * renglón de 30 × 5 bultos, que es como se cuentan al recibirlos.
 *
 * Sólo se juntan los IDÉNTICOS —misma talla, mismo foleo, misma anotación y
 * las mismas piezas por bulto—. Dos renglones que difieren en la anotación
 * siguen separados aunque sean de la misma talla: esa anotación es una
 * instrucción de trabajo y fundirla con otra la borra.
 *
 * Por talla y no por orden de captura porque el vale se cuenta talla por
 * talla contra los bultos del camión, no orden por orden.
 */
function mergeCutLines(
  lines: CutLineDraft[],
  sizeOrder: Map<string, number>,
): CutLineDraft[] {
  const merged = new Map<string, CutLineDraft>();

  for (const line of lines) {
    const key = [
      line.sizeId,
      line.tagId ?? "",
      line.notes ?? "",
      line.quantity,
    ].join("|");

    const current = merged.get(key);

    if (current) {
      current.bundles += line.bundles;
      continue;
    }

    merged.set(key, { ...line });
  }

  return [...merged.values()].sort(
    (a, b) =>
      (sizeOrder.get(a.sizeId) ?? 0) - (sizeOrder.get(b.sizeId) ?? 0) ||
      b.quantity - a.quantity,
  );
}
