import type { NavIconName } from "./nav-icons";
import type { Permission } from "./roles";

export interface NavItem {
  href: string;
  label: string;
  /** Nombre del icono, no el componente: debe cruzar servidor → cliente. */
  icon: NavIconName;
  /** Capacidad necesaria para verlo. Sin ella, el item no se pinta. */
  permission: Permission;
  /** Si aparece en la barra inferior del celular. Máximo 4 en toda la app. */
  showOnMobileBar?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    label: "Operación",
    items: [
      {
        href: "/dashboard",
        label: "Tablero",
        icon: "dashboard",
        permission: "inventory:browse",
        showOnMobileBar: true,
      },
      {
        href: "/lots",
        label: "Inventario",
        icon: "lots",
        permission: "inventory:browse",
        showOnMobileBar: true,
      },
      {
        href: "/lots/scan",
        label: "Escanear",
        icon: "scan",
        permission: "inventory:read",
        showOnMobileBar: true,
      },
      {
        href: "/calculations",
        label: "Cálculo",
        icon: "calculator",
        permission: "inventory:read",
        showOnMobileBar: true,
      },
    ],
  },
  {
    label: "Planeación",
    items: [
      {
        // El pizarrón del almacén: objetivos arriba, pendientes abajo. No es
        // parte del inventario, por eso va en su propia sección.
        href: "/tasks",
        label: "Tareas",
        icon: "tasks",
        permission: "inventory:read",
      },
      {
        /* Lo que SIEMPRE aplica: "el corte de Ternium lleva bolsa y bordado".
           Va junto a Tareas y no en Catálogos porque no es una lista de la
           que se elige al capturar, es algo que se consulta antes de trabajar.
           Pide `inventory:read` y no `browse`: de nada sirve una regla que
           Dirección o el de sólo lectura no pueden leer. */
        href: "/rules",
        label: "Reglas",
        icon: "rules",
        permission: "inventory:read",
      },
    ],
  },
  {
    label: "Catálogos",
    items: [
      {
        href: "/materials",
        label: "Materiales",
        icon: "materials",
        permission: "inventory:browse",
      },
      {
        href: "/products",
        label: "Productos",
        icon: "products",
        permission: "inventory:browse",
      },
      {
        href: "/sizes",
        label: "Tallas",
        icon: "sizes",
        permission: "inventory:browse",
      },
      {
        href: "/cut-tags",
        label: "Foleos",
        icon: "cutTags",
        permission: "inventory:browse",
      },
      {
        href: "/warehouses",
        label: "Almacenes",
        icon: "warehouses",
        permission: "inventory:browse",
      },
      {
        href: "/locations",
        label: "Ubicaciones",
        icon: "locations",
        permission: "inventory:browse",
      },
      {
        href: "/clients",
        label: "Clientes",
        icon: "clients",
        permission: "inventory:browse",
      },
      {
        href: "/production-runs",
        label: "Producciones",
        icon: "productionRuns",
        permission: "inventory:browse",
      },
      {
        href: "/partners",
        label: "Proveedores",
        icon: "partners",
        permission: "inventory:browse",
      },
      {
        href: "/helpers",
        label: "Ayudantes",
        icon: "helpers",
        permission: "inventory:read",
      },
    ],
  },
  {
    label: "Documentos",
    items: [
      {
        // Apunta al registro y no a /receipts/new: dar de alta es cosa de
        // una vez al día, pero "¿qué llegó en tal guía?" se pregunta a cada
        // rato. El alta se alcanza desde ahí con el botón "Nueva".
        href: "/receipts",
        label: "Recepciones",
        icon: "receipts",
        permission: "inventory:browse",
      },
      {
        // Apunta al registro y no a /issues/new por la misma razón que
        // Recepciones: consultar "¿qué salió para tal producción?" es lo
        // que se hace a cada rato; el alta se alcanza con el botón "Nueva".
        href: "/issues",
        label: "Salidas",
        icon: "issues",
        permission: "inventory:browse",
      },
      {
        href: "/orders",
        label: "Órdenes",
        icon: "orders",
        permission: "inventory:browse",
      },
      {
        // El kárdex, no los vales: aquí sólo aparece lo que YA afectó
        // existencias. Un vale en borrador no movió nada todavía, así que
        // vive en Salidas y no aquí.
        href: "/movements",
        label: "Movimientos",
        icon: "movements",
        permission: "inventory:browse",
      },
      {
        href: "/documents",
        label: "Documentos",
        icon: "documents",
        permission: "inventory:browse",
      },
      {
        href: "/purchase-requests",
        label: "Requisiciones",
        icon: "purchases",
        permission: "purchase:request",
      },
      {
        href: "/reports",
        label: "Reportes",
        icon: "reports",
        permission: "inventory:browse",
      },
      {
        href: "/audit",
        label: "Auditoría",
        icon: "audit",
        permission: "audit:read",
      },
    ],
  },
];

/**
 * Los 4 destinos de la barra inferior del celular.
 *
 * Se derivan de NAVIGATION en vez de repetirse, para que no se desincronicen
 * al renombrar una ruta. Son 4 porque con el pulgar no se atinan más.
 */
export const MOBILE_BAR_ITEMS: NavItem[] = NAVIGATION.flatMap((section) =>
  section.items.filter((item) => item.showOnMobileBar),
);

/**
 * A dónde entra cada quien al iniciar sesión.
 *
 * No puede ser `/dashboard` fijo: Dirección no tiene `inventory:browse`, así
 * que el tablero le está cerrado y aterrizaría en un error de permiso justo
 * después de escribir bien su contraseña. Se resuelve tomando el PRIMER
 * destino que su rol sí puede ver, que por el orden de NAVIGATION es el más
 * importante para ese rol.
 */
export function landingRoute(
  role: string,
  hasPermission: (role: string, permission: Permission) => boolean,
): string {
  const [primera] = visibleSections(role, hasPermission);
  return primera?.items[0]?.href ?? "/lots/scan";
}

/**
 * Secciones que el usuario puede ver, según su rol.
 *
 * Vive aquí y no en cada componente para que el sidebar de escritorio y el
 * menú de celular no se desincronicen: si un destino aparece en uno debe
 * aparecer en el otro.
 *
 * Ocultar el enlace es comodidad visual, no seguridad: la barrera real es
 * `requirePermission()` en el servidor.
 */
export function visibleSections(
  role: string,
  hasPermission: (role: string, permission: Permission) => boolean,
): NavSection[] {
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(role, item.permission)),
  })).filter((section) => section.items.length > 0);
}
