import {
  ArrowLeftRight,
  Boxes,
  Building2,
  Calculator,
  ChartColumn,
  ClipboardList,
  Factory,
  HardHat,
  FileText,
  LayoutDashboard,
  MapPin,
  Package,
  Package2,
  PackageMinus,
  Ruler,
  ScanLine,
  Truck,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Iconos de la navegación, indexados por nombre.
 *
 * Se guarda el NOMBRE en NAVIGATION y no el componente porque el sidebar es
 * Server Component y los enlaces son cliente: un componente de React no
 * sobrevive esa frontera —React sólo serializa datos—, así que cruza la
 * cadena y el cliente la resuelve contra este mapa.
 */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  lots: Boxes,
  scan: ScanLine,
  calculator: Calculator,
  materials: Package,
  products: Package2,
  sizes: Ruler,
  locations: MapPin,
  clients: Users,
  productionRuns: Factory,
  receipts: Truck,
  partners: Factory,
  helpers: HardHat,
  documents: FileText,
  issues: PackageMinus,
  movements: ArrowLeftRight,
  purchases: ShoppingCart,
  audit: ClipboardList,
  reports: ChartColumn,
  warehouses: Building2,
} as const satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICONS;
