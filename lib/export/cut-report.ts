/**
 * Las cuentas del reporte general de corte.
 *
 * Viven aparte de la ruta que arma el Excel porque son REGLAS, no formato: el
 * día que el umbral de retacería cambie o que alguien discuta un promedio,
 * esto es lo que se lee, y tiene que poder leerse sin bajar por doscientas
 * líneas de columnas de hoja de cálculo.
 *
 * Todas devuelven `null` cuando el dato no alcanza, y ese `null` es el punto:
 * es la diferencia entre "salió cero" y "no se ha medido". Un cero inventado
 * en el promedio real de una mesa que nadie midió se suma con los demás y
 * ensucia el promedio de toda la hoja.
 */

/** Lo que se capturó de una orden, ya en números planos. */
export interface CutReportInput {
  orderedQuantity: number;
  cutQuantity: number;
  metersDelivered: number | null;
  metersSpread: number | null;
  smallRemnant: number | null;
}

/** Lo que se calcula a partir de lo anterior. */
export interface CutReportTotals {
  /** Cortadas menos pedidas. Con signo: faltante en negativo. */
  difference: number;
  /** Qué tanto se pasó del pedido, en tanto por uno (0.02 = 2%). */
  surplusRate: number | null;
  /** Metros tendidos entre piezas cortadas: lo que costó cada prenda. */
  realAverage: number | null;
  /** Retacería chica sobre lo tendido, en tanto por uno. */
  remnantRate: number | null;
  /** Lo que sobró sin tender de la tela que mandó el cliente. */
  leftover: number | null;
}

export function cutReportTotals(input: CutReportInput): CutReportTotals {
  const { orderedQuantity, cutQuantity, metersSpread, smallRemnant } = input;

  return {
    difference: cutQuantity - orderedQuantity,
    /* Sobre lo PEDIDO, que es contra lo que se mide haberse pasado. Sin
       pedido no hay excedente que calcular, y dividir entre cero daría
       infinito. */
    surplusRate: divide(cutQuantity - orderedQuantity, orderedQuantity),
    /* Metros por pieza. Se pide que se haya cortado algo: dividir entre cero
       piezas daría infinito y en la columna se leería como un dato. */
    realAverage: divide(metersSpread, cutQuantity),
    remnantRate: divide(smallRemnant, metersSpread),
    leftover: leftoverMeters(input),
  };
}

/**
 * Lo que quedó SIN TENDER de la tela del cliente.
 *
 * Entregado menos tendido, y nada más. La retacería chica NO se resta aquí a
 * propósito: sale de dentro de lo que ya se tendió —son los pedazos que deja
 * el trazo— así que restarla otra vez la contaría dos veces y encogería el
 * sobrante de cada corte.
 *
 * Sin metros entregados no hay total del que sobre nada.
 */
function leftoverMeters({
  metersDelivered,
  metersSpread,
}: CutReportInput): number | null {
  if (metersDelivered === null) return null;
  return metersDelivered - (metersSpread ?? 0);
}

/** División que se rinde en vez de devolver infinito o `NaN`. */
function divide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator === 0) return null;

  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** Los días como los escribe la fábrica en la hoja: en mayúsculas. */
const WEEKDAYS = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIÉRCOLES",
  "JUEVES",
  "VIERNES",
  "SÁBADO",
] as const;

/**
 * El día de la semana de una fecha.
 *
 * La hoja de papel lo trae escrito al lado de la fecha porque la carga no se
 * reparte igual entre los días, y quien revisa el concentrado busca los lunes
 * o los viernes de un vistazo en vez de calcularlos.
 */
export function weekdayName(date: Date): string {
  /* `?? ""` y no un `!`: `getDay()` siempre cae en el arreglo, pero una fecha
     inválida devuelve `NaN` y ahí el índice no existe. Vale más una celda en
     blanco que un `undefined` impreso en la hoja. */
  return WEEKDAYS[date.getDay()] ?? "";
}
