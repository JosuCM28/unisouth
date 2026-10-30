import type { PrismaExecutor } from "@/lib/prisma";
import { BusinessRuleError, NotFoundError } from "@/lib/core/errors";
import { VoucherRepository } from "@/lib/repositories/voucher.repository";
import { toVoucherSheet, type VoucherSheet } from "@/lib/vouchers/voucher-sheet";

/** Cómo le fue a un envío, destinatario por destinatario. */
export interface VoucherDeliveryResult {
  /** Los nombres a los que sí les llegó. */
  sent: string[];
  /** A quién no, y por qué, para poder reenviarles sólo a ellos. */
  failed: { name: string; reason: string }[];
}

/**
 * La hoja de un vale que SE PUEDE mandar, por el canal que sea.
 *
 * Aparte de los servicios de WhatsApp y de correo para que la regla sea una
 * sola: si mañana se permite mandar otro tipo de vale, se cambia aquí y los
 * dos canales la siguen igual.
 */
export class SendableVoucher {
  constructor(private readonly db: PrismaExecutor) {}

  /**
   * El vale, sólo si es una salida aplicada o cancelada.
   *
   * Un borrador todavía puede cambiar: mandarlo sería repartir un papel que
   * mañana dice otra cosa. Uno cancelado SÍ se manda, pero como aviso: la
   * hoja trae la cancelación, así que el asunto, el mensaje y el PDF salen
   * marcados y nadie lo confunde con una entrega en pie.
   */
  async load(documentId: string): Promise<VoucherSheet> {
    const document = await new VoucherRepository(this.db).findSheetDocument(
      documentId,
    );
    if (!document) throw new NotFoundError("el vale", documentId);

    if (document.type !== "ISSUE") {
      throw new BusinessRuleError("Sólo las salidas se mandan a los contactos.");
    }

    if (document.status === "DRAFT") {
      throw new BusinessRuleError(
        `${document.code} sigue en borrador: sólo se manda un vale ya aplicado o cancelado.`,
      );
    }

    return toVoucherSheet(document);
  }
}
