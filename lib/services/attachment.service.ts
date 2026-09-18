import type { Attachment } from "@prisma/client";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import {
  deleteFileByKey,
  isSupportedDocument,
  isSupportedImage,
  saveFile,
  storageIsWritable,
} from "@/lib/core/storage";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_TECH_SHEET_BYTES,
  type AttachmentKind,
} from "@/lib/validations/attachment.schema";
import { BaseService } from "./base.service";

/** Lo que llega del formulario, ya leído del multipart. */
export interface UploadInput {
  orderId: string;
  /** El nombre con el que se escogió el archivo. Sólo para mostrar. */
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  /**
   * Foto del papel o ficha técnica en PDF.
   *
   * Por omisión foto: es lo que existía antes de que hubiera fichas, y así
   * una llamada vieja sigue significando lo mismo que significaba.
   */
  kind?: AttachmentKind;
}

/**
 * Las reglas de cada tipo de archivo, en un solo lugar.
 *
 * Diccionario y no `if` encadenados: agregar un tipo mañana es una entrada
 * más, sin tocar `upload()`.
 */
const KIND_RULES: Record<
  AttachmentKind,
  {
    accepts: (mimeType: string) => boolean;
    maxBytes: number;
    /** Cómo se llama en los mensajes que lee quien sube el archivo. */
    label: string;
    rejected: string;
  }
> = {
  PHOTO: {
    accepts: isSupportedImage,
    maxBytes: MAX_ATTACHMENT_BYTES,
    label: "La imagen",
    rejected: "Sólo se pueden subir imágenes: JPG, PNG o WEBP.",
  },
  TECH_SHEET: {
    accepts: isSupportedDocument,
    maxBytes: MAX_TECH_SHEET_BYTES,
    label: "La ficha técnica",
    rejected: "La ficha técnica tiene que ser un PDF.",
  },
};

/**
 * Los archivos que respaldan un papel.
 *
 * La orden de corte llega EN PAPEL: las tallas, las anotaciones y el sello del
 * cliente. Esa hoja es la única copia y vive en un folder sobre un escritorio.
 * Fotografiarla dentro de la orden es lo que impide que el día que se moje, se
 * traspapele o se la lleve quien renunció, no quede nada.
 *
 * Por eso las fotos NO se editan: se suben y se borran. Una foto corregida no
 * existe —se toma otra— y dejar cambiar los bytes por detrás convertiría el
 * respaldo en algo que ya no se puede creer.
 *
 * El archivo se escribe ANTES que el registro y a propósito. Al revés, un
 * fallo al escribir dejaría en la base una foto que no se puede abrir, y eso
 * no se nota hasta que alguien la busca. En este orden lo peor que queda es un
 * archivo suelto en el disco: invisible, y que no le miente a nadie.
 */
export class AttachmentService extends BaseService {
  async upload(input: UploadInput): Promise<Attachment> {
    const kind = input.kind ?? "PHOTO";
    const rules = KIND_RULES[kind];

    if (!rules.accepts(input.mimeType)) {
      throw new BusinessRuleError(rules.rejected);
    }

    if (input.bytes.byteLength === 0) {
      throw new BusinessRuleError("El archivo llegó vacío. Vuelve a intentar.");
    }

    if (input.bytes.byteLength > rules.maxBytes) {
      throw new BusinessRuleError(
        `${rules.label} pesa más de ${Math.round(rules.maxBytes / 1024 / 1024)} MB. Redúcela antes de subirla.`,
      );
    }

    /* Se revisa que la carpeta exista y se pueda escribir ANTES de aceptar
       nada. Sin volumen montado la foto se escribiría dentro del contenedor y
       el siguiente despliegue se la llevaría, dejando el registro apuntando a
       un archivo que ya no existe: un respaldo que miente es peor que no
       tenerlo. */
    if (!(await storageIsWritable())) {
      throw new BusinessRuleError(
        "El almacén de archivos no está disponible. Avisa al administrador: falta montar el volumen.",
      );
    }

    const order = await this.db.cuttingOrder.findUnique({
      where: { id: input.orderId },
      select: { id: true, code: true },
    });
    if (!order) throw new NotFoundError("la orden", input.orderId);

    const storageKey = await saveFile(input.bytes, input.mimeType);

    return this.transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          storageKey,
          /* Por dónde se sirve. Se guarda armada y no se arma al leer para
             que el día que cambie la ruta se vea en una migración, en vez de
             en una pantalla en blanco. */
          url: `/api/orders/${order.id}/photos`,
          name: cleanName(input.filename),
          mimeType: input.mimeType,
          sizeBytes: input.bytes.byteLength,
          type: kind,
          cuttingOrderId: order.id,
          uploadedById: this.context.userId,
        },
      });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: order.id,
        action: "UPDATE",
        reference: order.code,
        newValue: {
          archivo: attachment.name,
          tipo: kind,
          bytes: attachment.sizeBytes,
        },
        sensitivity: "LOW",
      });

      return attachment;
    });
  }

  /**
   * Quita la foto: el registro y el archivo.
   *
   * El archivo se borra DESPUÉS de que la transacción confirma. Al revés, si
   * la transacción se cayera el archivo ya no estaría y el registro seguiría
   * ahí, apuntando a nada.
   */
  async remove(id: string): Promise<Attachment> {
    const attachment = await this.transaction(async (tx) => {
      const current = await tx.attachment.findUnique({
        where: { id },
        include: { cuttingOrder: { select: { code: true } } },
      });
      if (!current) throw new NotFoundError("el archivo", id);

      await tx.attachment.delete({ where: { id } });

      await this.auditWith(tx).record({
        entity: "CuttingOrder",
        entityId: current.cuttingOrderId ?? id,
        action: "UPDATE",
        reference: current.cuttingOrder?.code ?? current.name,
        oldValue: { archivo: current.name, tipo: current.type },
        /* MEDIUM y no LOW: esto destruye el respaldo de un papel que puede
           ser la única copia que queda. No exige motivo —se borra sobre todo
           la foto movida o repetida, y pedirlo lograría que nadie limpie—
           pero tiene que saltar en el tablero de auditoría. */
        sensitivity: "MEDIUM",
      });

      return current;
    });

    if (attachment.storageKey) {
      await deleteFileByKey(attachment.storageKey);
    }

    return attachment;
  }
}

/**
 * El nombre que se muestra y con el que se descarga.
 *
 * Se limpia de rutas porque algunos navegadores mandan el camino completo y
 * "C:\fakepath\orden.jpg" en pantalla no le dice nada a nadie. NO es una
 * medida de seguridad: este nombre jamás toca el disco —el archivo se llama
 * como lo bautiza `saveFile`— y ésa es la barrera de verdad.
 */
function cleanName(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const trimmed = base.trim().slice(0, 120);
  return trimmed.length > 0 ? trimmed : "foto.jpg";
}
