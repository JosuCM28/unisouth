import { deflateRawSync, crc32 } from "node:zlib";

/**
 * Contenedor ZIP mínimo, lo justo para armar un .xlsx.
 *
 * Un .xlsx ES un ZIP de archivos XML. Se escribe a mano y no con una librería
 * por la misma razón por la que el CSV se escribe a mano: `xlsx` de npm
 * arrastra vulnerabilidades sin parchar, y meter una dependencia con historial
 * de CVEs en el servidor para generar una tabla no vale el riesgo.
 *
 * Sólo implementa lo que Excel necesita para abrir el archivo: entradas
 * comprimidas con deflate, sin cifrado, sin ZIP64 y sin carpetas. Con el tope
 * de filas de la app ninguna hoja se acerca a los límites de ese formato.
 */
interface ZipEntry {
  name: string;
  data: Buffer;
  crc: number;
  compressed: Buffer;
  offset: number;
}

/** Fecha y hora en el formato MS-DOS que pide la especificación del ZIP. */
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (Math.floor(date.getSeconds() / 2) & 0x1f) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getHours() & 0x1f) << 11);

  const day =
    (date.getDate() & 0x1f) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    // El ZIP cuenta los años desde 1980.
    ((Math.max(0, date.getFullYear() - 1980) & 0x7f) << 9);

  return { time, date: day };
}

export function createZip(files: { name: string; content: string }[]): Buffer {
  const stamp = dosDateTime(new Date());
  const entries: ZipEntry[] = [];
  const chunks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const data = Buffer.from(file.content, "utf-8");
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const name = Buffer.from(file.name, "utf-8");

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // firma local
    header.writeUInt16LE(20, 4); // versión mínima
    header.writeUInt16LE(0, 6); // sin banderas
    header.writeUInt16LE(8, 8); // método: deflate
    header.writeUInt16LE(stamp.time, 10);
    header.writeUInt16LE(stamp.date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28); // sin campo extra

    chunks.push(header, name, compressed);
    entries.push({ name: file.name, data, crc, compressed, offset });
    offset += header.length + name.length + compressed.length;
  }

  // Directorio central: el índice que Excel lee primero para saber qué trae.
  const centralStart = offset;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf-8");
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4); // versión de creación
    header.writeUInt16LE(20, 6); // versión mínima
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt16LE(stamp.time, 12);
    header.writeUInt16LE(stamp.date, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.compressed.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30); // extra
    header.writeUInt16LE(0, 32); // comentario
    header.writeUInt16LE(0, 34); // disco
    header.writeUInt16LE(0, 36); // atributos internos
    header.writeUInt32LE(0, 38); // atributos externos
    header.writeUInt32LE(entry.offset, 42);

    chunks.push(header, name);
    offset += header.length + name.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // disco
  end.writeUInt16LE(0, 6); // disco del directorio
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20); // sin comentario

  chunks.push(end);
  return Buffer.concat(chunks);
}
