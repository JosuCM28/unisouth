import { EvolutionClient } from "@/lib/core/evolution-client";
import {
  BusinessRuleError,
  DomainError,
  NotFoundError,
} from "@/lib/core/errors";
import { VoucherRepository } from "@/lib/repositories/voucher.repository";
import {
  WhatsappContactRepository,
  type WhatsappRecipient,
} from "@/lib/repositories/whatsapp-contact.repository";
import type { SendVoucherWhatsappInput } from "@/lib/validations/whatsapp.schema";
import { renderVoucherPdf } from "@/lib/vouchers/voucher-pdf";
import {
  toVoucherSheet,
  voucherFileName,
  type VoucherSheet,
} from "@/lib/vouchers/voucher-sheet";
import { BaseService } from "./base.service";

/** Cómo le fue al envío, contacto por contacto. */
export interface VoucherWhatsappResult {
  /** Los nombres a los que sí les llegó. */
  sent: string[];
  /** A quién no, y por qué, para poder reenviarles sólo a ellos. */
  failed: { name: string; reason: string }[];
}

/**
 * Manda el PDF de UN vale aplicado por WhatsApp.
 *
 * Uno y no varios a propósito: cada envío a taller produce su propio vale y
 * se aplica por separado, así que lo que se manda es exactamente el papel que
 * se acaba de aplicar, y no el resto de los envíos de la misma orden.
 *
 * Va APARTE de aplicar y nunca dentro de su transacción. Aplicar mueve
 * inventario y no puede quedar esperando a un celular sin señal, ni
 * revertirse porque WhatsApp tardó: primero se aplica, y ya aplicado se
 * manda. Si el envío falla, la salida sigue aplicada y se puede reenviar.
 */
export class VoucherWhatsappService extends BaseService {
  async send(input: SendVoucherWhatsappInput): Promise<VoucherWhatsappResult> {
    const client = requireClient();
    const sheet = await this.loadSendableSheet(input.documentId);
    const recipients = await this.loadRecipients(input.contactIds);

    // El PDF se arma UNA vez: es el mismo archivo para todos.
    const pdf = await renderVoucherPdf(sheet);
    const base64 = pdf.toString("base64");
    const caption = captionOf(sheet);

    const outcomes: Outcome[] = [];

    /* Uno tras otro y no en paralelo: salen del MISMO celular, y una ráfaga
       de envíos simultáneos es justo lo que WhatsApp castiga bloqueando el
       número. Con cinco contactos la diferencia son un par de segundos. */
    for (const recipient of recipients) {
      try {
        await client.sendDocument({
          phone: recipient.phone,
          base64,
          fileName: voucherFileName(sheet),
          mimeType: "application/pdf",
          caption,
        });
        outcomes.push({ recipient, error: null });
      } catch (error) {
        outcomes.push({ recipient, error: reasonOf(error) });
      }
    }

    await this.recordSend(input.documentId, sheet.code, outcomes);

    return {
      sent: outcomes
        .filter((outcome) => outcome.error === null)
        .map((outcome) => outcome.recipient.name),
      failed: outcomes.flatMap(({ recipient, error }) =>
        error === null ? [] : [{ name: recipient.name, reason: error }],
      ),
    };
  }

  /**
   * El vale, sólo si es una salida aplicada.
   *
   * Un borrador todavía puede cambiar: mandarlo sería repartir un papel que
   * mañana dice otra cosa. Uno cancelado ya no vale, y mandarlo haría creer
   * que esa entrega sigue en pie.
   */
  private async loadSendableSheet(documentId: string): Promise<VoucherSheet> {
    const document = await new VoucherRepository(this.db).findSheetDocument(
      documentId,
    );
    if (!document) throw new NotFoundError("el vale", documentId);

    if (document.type !== "ISSUE") {
      throw new BusinessRuleError("Sólo las salidas se mandan por WhatsApp.");
    }

    if (document.status !== "APPLIED") {
      throw new BusinessRuleError(
        `${document.code} no está aplicada: sólo se manda un vale ya aplicado.`,
      );
    }

    return toVoucherSheet(document);
  }

  private async loadRecipients(ids: string[]): Promise<WhatsappRecipient[]> {
    const recipients = await new WhatsappContactRepository(this.db).findByIds(
      ids,
    );

    if (recipients.length === 0) {
      throw new BusinessRuleError(
        "Esos contactos ya no existen. Vuelve a abrir el vale y elígelos otra vez.",
      );
    }

    return recipients;
  }

  /**
   * Queda en la bitácora a quién se mandó y a quién no.
   *
   * Con el número escrito y no sólo el nombre: si mañana alguien cambia el
   * número de un contacto, la bitácora tiene que seguir diciendo a qué
   * teléfono salió ESTE vale.
   */
  private async recordSend(
    documentId: string,
    code: string,
    outcomes: Outcome[],
  ) {
    const label = ({ recipient }: Outcome) =>
      `${recipient.name} (${recipient.phone})`;

    await this.audit.record({
      entity: "InventoryDocument",
      entityId: documentId,
      action: "EXPORT",
      reference: code,
      newValue: {
        via: "WhatsApp",
        enviados: outcomes.filter((o) => o.error === null).map(label),
        fallidos: outcomes
          .filter((o) => o.error !== null)
          .map((o) => `${label(o)}: ${o.error}`),
      },
      sensitivity: "LOW",
    });
  }
}

/** El resultado de mandarle el vale a un contacto. `error` null = llegó. */
interface Outcome {
  recipient: WhatsappRecipient;
  error: string | null;
}

/** El cliente de Evolution, o un error que se lee en pantalla. */
function requireClient(): EvolutionClient {
  const client = EvolutionClient.fromEnv();
  if (client) return client;

  throw new BusinessRuleError(
    "WhatsApp no está configurado. Faltan las variables EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE.",
  );
}

/**
 * El texto que acompaña al PDF en el chat.
 *
 * Lo que se lee sin abrir el archivo: qué es, de qué orden y cuántas prendas.
 * Con eso quien lo recibe sabe si le toca antes de descargarlo.
 */
function captionOf(sheet: VoucherSheet): string {
  const order = sheet.header.find((field) => field.label === "Orden");
  const lines = [`*${sheet.title} ${sheet.code}*`];

  if (order) lines.push(`Orden: ${order.value}`);
  if (sheet.cutRows.length > 0) {
    lines.push(`Total de cortes entregados: ${sheet.cutTotals.pieces}`);
  }

  return lines.join("\n");
}

/**
 * El motivo de un fallo, para quien envió.
 *
 * Un DomainError ya viene redactado para el usuario; cualquier otra cosa es
 * un bug y no se enseña crudo.
 */
function reasonOf(error: unknown): string {
  if (error instanceof DomainError) return error.message;

  console.error("[VoucherWhatsappService] Error inesperado al enviar:", error);
  return "Error inesperado al enviar.";
}
