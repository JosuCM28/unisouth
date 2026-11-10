import { APP_TIMEZONE } from "@/lib/utils";

/*
 * Las partes de la fecha EN LA FÁBRICA. Un solo formateador para todo el
 * archivo: crearlo por celda cuesta, y una exportación trae miles.
 */
const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsOf(date: Date): WallClock {
  const found = new Map(
    PARTS.formatToParts(date).map((part) => [part.type, Number(part.value)]),
  );
  // Una fecha inválida no trae partes y da NaN, igual que con `getHours()`.
  const read = (type: Intl.DateTimeFormatPartTypes) => found.get(type) ?? NaN;

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Días desde 1900 con los que Excel representa una fecha.
 *
 * Excel no sabe de zonas horarias: guarda la hora "de pared" tal cual. Por eso
 * se escribe la hora EN LA FÁBRICA y no la del servidor. Producción corre en
 * UTC, y con `getHours()` un rollo recibido a las 7 de la noche salía en el
 * Excel a la 1 de la mañana del día siguiente —corrido de día, de semana y a
 * veces de mes—, aunque en la pantalla se viera bien.
 *
 * La base es el 30 de diciembre de 1899 y no el 1 de enero de 1900 porque
 * Excel cree que el 29 de febrero de 1900 existió —un error heredado de Lotus
 * 1-2-3 que conserva por compatibilidad—. Sin reproducirlo, todas las fechas
 * salen corridas un día.
 */
export function excelSerialDate(date: Date): number {
  const p = partsOf(date);
  const epoch = Date.UTC(1899, 11, 30);
  const wallClock = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

  return (wallClock - epoch) / 86_400_000;
}

/** Sólo el día, sin hora: la columna de fecha corta no debe arrastrar fracción. */
export function excelSerialDay(date: Date): number {
  return Math.floor(excelSerialDate(date));
}
