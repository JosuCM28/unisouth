import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Dónde viven los archivos que sube la gente.
 *
 * Disco del servidor y no la base: una foto de un papel pesa cientos de
 * kilobytes y meterla en Postgres engorda cada respaldo de la base —que se
 * hace seguido y tiene que ser rápido— con datos que nunca se consultan en
 * una query. En producción la carpeta es un volumen montado en el contenedor;
 * en local, una carpeta del proyecto ignorada por git.
 *
 * NADA de lo que manda el navegador toca el nombre del archivo. El nombre lo
 * inventa el servidor y la extensión sale del tipo que se validó, no de la
 * cadena que venga en el formulario: un nombre como `../../server.js` escrito
 * tal cual sobreescribiría la app.
 */

/** La carpeta raíz. En el contenedor la pone el Dockerfile. */
function root(): string {
  return process.env.UPLOADS_DIR || ".uploads";
}

/**
 * Extensión por tipo. Las dos listas juntas son los tipos permitidos.
 *
 * Están separadas porque se validan por separado: al bloque de fotos no se le
 * cuela un PDF, y al de fichas técnicas no se le cuela un JPG. Si fueran una
 * sola lista, cualquiera de los dos aceptaría lo del otro.
 */
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const DOCUMENT_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
};

const EXTENSIONS: Record<string, string> = {
  ...IMAGE_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
};

export function isSupportedImage(mimeType: string): boolean {
  return mimeType in IMAGE_EXTENSIONS;
}

/**
 * Sólo PDF.
 *
 * Ni Word ni Excel a propósito: la ficha técnica se imprime y se clava en la
 * mesa de corte, y un .docx se ve distinto en cada máquina que lo abra. El
 * PDF es el único formato que sale igual en todas.
 */
export function isSupportedDocument(mimeType: string): boolean {
  return mimeType in DOCUMENT_EXTENSIONS;
}

/** Los tipos que acepta el `<input type="file">`, para no repetir la lista. */
export const SUPPORTED_IMAGE_TYPES = Object.keys(IMAGE_EXTENSIONS);
export const SUPPORTED_DOCUMENT_TYPES = Object.keys(DOCUMENT_EXTENSIONS);

/**
 * Guarda el archivo y devuelve su llave: el nombre con el que vive en disco.
 *
 * La llave se genera aquí y es lo único que se guarda en la base. Así el
 * registro nunca apunta a una ruta absoluta del servidor, que cambiaría si
 * algún día las fotos se mudan de lugar.
 *
 * Reparte en carpetas por año y mes. Un solo directorio con decenas de miles
 * de archivos se vuelve lento de listar en el sistema de archivos, y estas
 * fotos se acumulan para siempre porque son el respaldo.
 */
export async function saveFile(
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const extension = EXTENSIONS[mimeType];
  if (!extension) {
    throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
  }

  const now = new Date();
  const folder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = `${folder}/${randomUUID()}.${extension}`;

  const target = resolveKey(key);
  await mkdir(join(root(), folder), { recursive: true });
  await writeFile(target, bytes);

  return key;
}

export async function readFileByKey(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

/**
 * Borra el archivo. Que ya no esté NO es un error.
 *
 * Si el archivo se perdió —un volumen que no estaba montado, una restauración
 * a medias— lo que no puede pasar es que su registro se quede clavado en la
 * base para siempre, sin foto y sin forma de quitarlo de la pantalla.
 */
export async function deleteFileByKey(key: string): Promise<void> {
  try {
    await unlink(resolveKey(key));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

/**
 * ¿Se puede escribir en la carpeta?
 *
 * La pantalla lo pregunta para avisar ANTES de que alguien intente subir. Sin
 * volumen montado la app aceptaría la foto, la escribiría dentro del
 * contenedor y el siguiente despliegue se la llevaría sin que nadie se
 * enterara: el registro en la base seguiría ahí, apuntando a un archivo que ya
 * no existe.
 */
export async function storageIsWritable(): Promise<boolean> {
  try {
    const probe = join(root(), `.probe-${randomUUID()}`);
    await mkdir(root(), { recursive: true });
    await writeFile(probe, "");
    await unlink(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * La ruta en disco de una llave, sólo si de verdad cae dentro de la carpeta.
 *
 * La llave viene de la base y la base la escribió esta misma función, así que
 * en teoría siempre es segura. Se comprueba de todos modos: es la única
 * barrera entre un registro alterado y leer cualquier archivo del servidor, y
 * cuesta dos líneas.
 */
function resolveKey(key: string): string {
  const base = normalize(root());
  const target = normalize(join(base, key));

  if (target !== base && !target.startsWith(base + "/") && !target.startsWith(base + "\\")) {
    throw new Error("Ruta de archivo inválida");
  }

  return target;
}
