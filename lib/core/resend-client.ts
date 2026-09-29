import { ExternalServiceError } from "./errors";

/**
 * Cliente de Resend: el ÚNICO lugar de la app que manda correos.
 *
 * Habla con la API REST directo, con `fetch`, igual que EvolutionClient con
 * WhatsApp: el SDK sólo envolvería este mismo POST y sería una dependencia
 * más que actualizar. El día que se cambie de proveedor se reescribe este
 * archivo y nada más.
 *
 * Basta `RESEND_API_KEY` para que exista. Sin ella `fromEnv()` da null y la
 * app sigue funcionando: aplicar una salida jamás depende del correo.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * El remitente de fábrica, en el dominio ya verificado en Resend.
 *
 * Va escrito aquí para que en Dokploy sólo haga falta pegar la llave;
 * `RESEND_FROM` lo cambia sin tocar código si algún día se quiere otro.
 */
const DEFAULT_FROM = "UNISOUTH <salidas@aux.unisoutheast.com>";

/** Lo que se espera a Resend antes de darlo por caído. */
const REQUEST_TIMEOUT_MS = 30_000;

export interface EmailAttachment {
  fileName: string;
  /** El archivo en base64 puro, sin el prefijo `data:`. */
  base64: string;
}

export interface OutgoingEmail {
  to: string[];
  subject: string;
  /** Texto plano: se lee igual en el celular del taller que en Outlook. */
  text: string;
  attachments?: EmailAttachment[];
}

interface ResendConfig {
  apiKey: string;
  from: string;
}

export class ResendClient {
  private readonly config: ResendConfig;

  private constructor(config: ResendConfig) {
    this.config = config;
  }

  /** El cliente armado con las variables de entorno, o null sin llave. */
  static fromEnv(): ResendClient | null {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return null;

    return new ResendClient({
      apiKey,
      from: process.env.RESEND_FROM?.trim() || DEFAULT_FROM,
    });
  }

  /** ¿Se puede enviar? La pantalla lo pregunta para no ofrecer lo imposible. */
  static isConfigured(): boolean {
    return ResendClient.fromEnv() !== null;
  }

  /** Manda un correo. Lanza ExternalServiceError si Resend no lo acepta. */
  async send(email: OutgoingEmail): Promise<void> {
    const response = await this.post({
      from: this.config.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      attachments: email.attachments?.map((attachment) => ({
        filename: attachment.fileName,
        content: attachment.base64,
      })),
    });

    if (!response.ok) {
      throw new ExternalServiceError(await describeFailure(response));
    }
  }

  /**
   * El POST con su llave y su tope de tiempo.
   *
   * Un fallo de red se traduce aquí: el `TypeError: fetch failed` crudo no
   * le dice nada a quien está aplicando la salida.
   */
  private async post(body: unknown): Promise<Response> {
    try {
      return await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      console.error("[ResendClient] Sin respuesta de Resend:", error);
      throw new ExternalServiceError(
        "El servicio de correo no respondió. Intenta reenviar en un momento.",
      );
    }
  }
}

/**
 * El motivo del rechazo, en palabras del almacén.
 *
 * Los casos que de verdad pasan —llave mal pegada en Dokploy, dominio que
 * perdió su verificación, demasiados envíos seguidos— se dicen tal cual; lo
 * demás se registra completo en el servidor y se resume.
 */
async function describeFailure(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  console.error(
    `[ResendClient] Resend respondió ${response.status}:`,
    detail.slice(0, 500),
  );

  if (/domain.*not verified|verify a domain/i.test(detail)) {
    return "El dominio del remitente no está verificado en Resend. Revisa RESEND_FROM.";
  }

  if (response.status === 401 || response.status === 403) {
    return "Resend rechazó la llave de acceso. Revisa RESEND_API_KEY.";
  }

  if (response.status === 429) {
    return "Demasiados correos seguidos. Espera un minuto y reenvía.";
  }

  if (response.status === 422) {
    return "Resend rechazó el correo: revisa que las direcciones estén bien escritas.";
  }

  return `El servicio de correo rechazó el envío (error ${response.status}).`;
}
