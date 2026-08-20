/**
 * Colores que se le pueden poner a un objetivo o a una tarjeta.
 *
 * Se guarda la CLAVE ("amber") y no el color: así el tablero respeta el tema
 * claro/oscuro y un cambio de paleta no obliga a reescribir filas de la base.
 *
 * Son seis y no una rueda completa a propósito: con demasiados nadie recuerda
 * qué significaba cada uno y el color deja de comunicar.
 */
export const BOARD_COLORS = [
  { key: "slate", label: "Gris" },
  { key: "amber", label: "Ámbar" },
  { key: "green", label: "Verde" },
  { key: "red", label: "Rojo" },
  { key: "violet", label: "Violeta" },
  { key: "blue", label: "Azul" },
] as const;

export type BoardColor = (typeof BOARD_COLORS)[number]["key"];

export const DEFAULT_BOARD_COLOR: BoardColor = "slate";

/** Franja lateral de la tarjeta: es lo que se ve de reojo en el tablero. */
export const BOARD_COLOR_BAR: Record<BoardColor, string> = {
  slate: "bg-muted-foreground",
  amber: "bg-state-reserved",
  green: "bg-state-available",
  red: "bg-state-defective",
  violet: "bg-state-remnant",
  blue: "bg-primary",
};

/** El botón del selector de color. */
export const BOARD_COLOR_DOT: Record<BoardColor, string> = BOARD_COLOR_BAR;

export function isBoardColor(value: unknown): value is BoardColor {
  return BOARD_COLORS.some((color) => color.key === value);
}
