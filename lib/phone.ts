/**
 * Números de teléfono: cómo se guardan y cómo se leen.
 *
 * Se guardan como los pide WhatsApp —sólo dígitos y con lada— y se enseñan
 * agrupados, porque "5212291234567" no se puede cotejar de un vistazo contra
 * el número que alguien está dictando.
 */

/**
 * Lada de México. Un número de 10 dígitos —como se dicta por teléfono— se
 * completa con ella, porque WhatsApp necesita el número internacional.
 */
const MEXICO_CODE = "52";

/**
 * Deja el número como lo espera WhatsApp: sólo dígitos y con lada.
 *
 * Se acepta como lo teclea la gente —"229 123 4567", "+52 (229) 123-4567"—
 * porque exigir un formato exacto es la forma segura de que alguien escriba
 * mal el número para que el formulario lo deje pasar.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 ? `${MEXICO_CODE}${digits}` : digits;
}

/** "5212291234567" → "+52 229 123 4567". Lo que no es de México, tal cual. */
export function formatPhone(phone: string): string {
  const match = /^52(\d{3})(\d{3})(\d{4})$/.exec(phone);
  if (!match) return `+${phone}`;

  const [, area, first, last] = match;
  return `+52 ${area} ${first} ${last}`;
}

/** El número sin lada, para volver a ponerlo en el campo al editar. */
export function localPhone(phone: string): string {
  return phone.startsWith(MEXICO_CODE) && phone.length === 12
    ? phone.slice(MEXICO_CODE.length)
    : phone;
}
