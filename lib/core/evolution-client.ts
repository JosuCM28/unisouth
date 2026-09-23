import { ExternalServiceError } from "./errors";

/**
 * Cliente de Evolution API v2: el ÚNICO lugar de la app que habla con WhatsApp.
 *
 * Se aísla aquí para que el resto no sepa de URLs, llaves ni del formato del
 * cuerpo. El día que cambie la versión de Evolution —o se cambie de
 * proveedor— se reescribe este archivo y nada más.
 *
 * Se configura con tres variables de entorno. Sin alguna de ellas el cliente
 * no existe (`fromEnv()` da null) y la app sigue funcionando: aplicar una
 * salida jamás depende de que WhatsApp esté configurado.
 */

interface EvolutionConfig {
  /** Raíz de la instancia de Evolution, sin la diagonal final. */
  baseUrl: string;
  apiKey: string;
  /** El nombre de la instancia donde está vinculado el celular. */
  instance: string;
}

export interface WhatsappDocument {
  /** Sólo dígitos y con lada: "5212291234567". */
  phone: string;
  /** El archivo en base64 puro, sin el prefijo `data:`. */
  base64: string;
  fileName: string;
  mimeType: string;
  /** El texto que acompaña al archivo en el chat. */
  caption?: string;
}

/**
 * Lo que se espera a Evolution antes de darlo por caído.
 *
 * Sin tope, un celular sin señal deja colgada la petición y quien aplicó la
 * salida se queda mirando un botón que gira sin saber si llegó.
 */
const REQUEST_TIMEOUT_MS = 30_000;

export class EvolutionClient {
  private readonly config: EvolutionConfig;

  private constructor(config: EvolutionConfig) {
    this.config = config;
  }

  /** El cliente armado con las variables de entorno, o null si falta alguna. */
  static fromEnv(): EvolutionClient | null {
    const baseUrl = process.env.EVOLUTION_API_URL?.trim();
    const apiKey = process.env.EVOLUTION_API_KEY?.trim();
    const instance = process.env.EVOLUTION_INSTANCE?.trim();

    if (!baseUrl || !apiKey || !instance) return null;

    return new EvolutionClient({
      baseUrl: baseUrl.replace(/\/+$/, ""),
      apiKey,
      instance,
    });
  }

  /** ¿Se puede enviar? La pantalla lo pregunta para no ofrecer lo imposible. */
  static isConfigured(): boolean {
    return EvolutionClient.fromEnv() !== null;
  }

  /** Manda un archivo a un número. Lanza ExternalServiceError si no llega. */
  async sendDocument(document: WhatsappDocument): Promise<void> {
    const url = `${this.config.baseUrl}/message/sendMedia/${encodeURIComponent(
      this.config.instance,
    )}`;

    const response = await this.post(url, {
      number: document.phone,
      mediatype: "document",
      mimetype: document.mimeType,
      media: document.base64,
      fileName: document.fileName,
      caption: document.caption,
    });

    if (!response.ok) {
      throw new ExternalServiceError(await describeFailure(response));
    }
  }

  /**
   * El POST con su llave y su tope de tiempo.
   *
   * Un fallo de red se traduce aquí a ExternalServiceError: el `TypeError:
   * fetch failed` crudo no le dice nada a quien está en el almacén.
   */
  private async post(url: string, body: unknown): Promise<Response> {
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.config.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      console.error("[EvolutionClient] Sin respuesta de Evolution:", error);
      throw new ExternalServiceError(
        "WhatsApp no respondió. Revisa que el servidor de Evolution esté encendido.",
      );
    }
  }
}

/**
 * El motivo del rechazo, en palabras del almacén.
 *
 * Los dos casos que de verdad pasan en el piso —el celular se desvinculó y el
 * número no tiene WhatsApp— se dicen tal cual; lo demás se registra completo
 * en el servidor y se resume.
 */
async function describeFailure(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  console.error(
    `[EvolutionClient] Evolution respondió ${response.status}:`,
    detail.slice(0, 500),
  );

  if (response.status === 401 || response.status === 403) {
    return "WhatsApp rechazó la llave de acceso. Revisa EVOLUTION_API_KEY.";
  }

  if (response.status === 404) {
    return "No existe la instancia de WhatsApp. Revisa EVOLUTION_INSTANCE.";
  }

  if (/exists["']?\s*:\s*false/i.test(detail)) {
    return "Ese número no tiene WhatsApp.";
  }

  if (/connection closed|not connected|close/i.test(detail)) {
    return "El celular de WhatsApp está desconectado. Vuelve a vincularlo en Evolution.";
  }

  return `WhatsApp rechazó el envío (error ${response.status}).`;
}
