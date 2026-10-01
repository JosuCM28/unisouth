/**
 * Reconstruye los bultos de un corte global capturado ANTES de guardarse su
 * captura física (`GlobalCutBundle`).
 *
 * El repartidor de entonces, cuando un bulto completaba una orden y le
 * sobraban piezas que se quedaban en esa MISMA orden, lo guardaba en dos
 * renglones de un bulto cada uno: un bulto de 28 quedaba como "1×24" y "1×4".
 * Los bultos enteros que no se partían quedaban juntos en un solo renglón con
 * su número de bultos ("3×60"), así que los pedazos se reconocen por ser
 * renglones de UN bulto en el mismo renglón de la orden, y se vuelven a sumar
 * en uno solo.
 *
 * Es una reconstrucción, no un dato: si en la mesa de verdad se amarraron dos
 * bultos sueltos distintos para la misma talla de la misma orden, aquí se
 * verían como uno. Por eso sólo se usa mientras el corte no tenga captura, y
 * guardar el corte global una vez la deja fija con lo que se revise en
 * pantalla.
 */

export interface LegacyEntry {
  lineId: string;
  quantity: number;
  bundles: number;
  tagId: string | null;
}

export function mergeLegacyFragments<T extends LegacyEntry>(entries: T[]): T[] {
  const merged = new Map<string, T>();
  const kept: T[] = [];

  for (const entry of entries) {
    // Las correcciones en negativo y los bultos múltiples nunca fueron pedazos.
    if (entry.bundles !== 1 || entry.quantity <= 0) {
      kept.push(entry);
      continue;
    }

    const current = merged.get(entry.lineId);
    if (current) {
      merged.set(entry.lineId, {
        ...current,
        quantity: current.quantity + entry.quantity,
      });
    } else {
      merged.set(entry.lineId, { ...entry });
    }
  }

  return [...merged.values(), ...kept];
}
