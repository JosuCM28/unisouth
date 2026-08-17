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
        permission: "inventory:read",
        showOnMobileBar: true,
      },
      {
        href: "/lots",
        label: "Inventario",
        icon: "lots",
        permission: "inventory:read",
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
    label: "Catálogos",
    items: [
      {
        href: "/materials",
        label: "Materiales",
        icon: "materials",
        permission: "inventory:read",
      },
      {
        href: "/products",
        label: "Productos",
        icon: "products",
        permission: "inventory:read",
      },
      {
        href: "/sizes",
        label: "Tallas",
        icon: "sizes",
        permission: "inventory:read",
      },
      {
        href: "/warehouses",
        label: "Almacenes",
        icon: "warehouses",
        permission: "inventory:read",
      },
      {
        href: "/locations",
        label: "Ubicaciones",
        icon: "locations",
        permission: "inventory:read",
      },
      {
        href: "/clients",
        label: "Clientes",
        icon: "clients",
        permission: "inventory:read",
      },
      {
        href: "/production-runs",
        label: "Producciones",
        icon: "productionRuns",
        permission: "inventory:read",
      },
      {
        href: "/partners",
        label: "Proveedores",
        icon: "partners",
        permission: "inventory:read",
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
        permission: "inventory:read",
      },
      {
        href: "/documents",
        label: "Documentos",
        icon: "documents",
        permission: "inventory:read",
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
        permission: "inventory:read",
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
