/**
 * Estado plegado/desplegado de la barra lateral.
 *
 * Se guarda en COOKIE y no en localStorage porque el layout es Server
 * Component y la lee al renderizar: así la barra sale ya en su sitio. Con
 * localStorage el servidor no sabría nada y en cada carga la barra aparecería
 * desplegada un instante antes de plegarse sola, que es justo el parpadeo que
 * hace ver rota una aplicación.
 */
export const SIDEBAR_COOKIE = "sidebar";

/** Un año: es una preferencia de cómo trabaja la persona, no una sesión. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Por omisión, desplegada.
 *
 * Sólo se pliega si la cookie dice explícitamente que sí: quien nunca la ha
 * tocado —o entra desde otra computadora— espera ver el menú, no una pantalla
 * sin navegación que tiene que averiguar cómo abrir.
 */
export function isSidebarOpen(value: string | undefined): boolean {
  return value !== "0";
}
