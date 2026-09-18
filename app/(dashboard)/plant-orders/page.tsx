import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/core/session";
import { roleHasPermission } from "@/lib/constants/roles";
import { getOrderFormOptions } from "@/lib/order-form-options";
import {
  cuttingOrderWhere,
  parseCuttingOrderFilters,
} from "@/lib/repositories/cutting-order-filters";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { PlantOrderFilters } from "@/components/plant-orders/plant-order-filters";
import { PlantOrderTable } from "@/components/plant-orders/plant-order-table";

export const metadata: Metadata = { title: "Órdenes de planta" };

const PAGE_SIZE = 50;
/** Los tamaños que ofrece el selector de la tabla. Cualquier otro se ignora. */
const PAGE_SIZES = [10, 25, 50, 100];

interface PageProps {
  searchParams: Promise<{
    q?: string;
    agregadas?: string;
    page?: string;
    all?: string;
    filas?: string;
  }>;
}

/**
 * Las órdenes que captura la OTRA PLANTA.
 *
 * Son órdenes de corte normales —la misma tabla, las mismas tallas, el mismo
 * catálogo— con una diferencia: nacen fuera del concentrado de la casa. Aquí
 * se ven todas, agregadas o no, y quien administra decide cuáles entran.
 *
 * Quien captura allá abajo ve esta misma lista sin los botones: le sirve para
 * saber si ya se la tomaron, que es justo lo que antes tenía que preguntar
 * por teléfono.
 */
export default async function PlantOrdersPage({ searchParams }: PageProps) {
  const user = await requirePermission("plant-orders:browse");
  /* Agregar al concentrado es decidir qué se tiende en la mesa de acá, así
     que lleva su propia llave y Dirección no la tiene. Esconder el botón es
     comodidad; la barrera de verdad es `executeAction`. */
  const canAdopt = roleHasPermission(user.role, "plant-orders:adopt");
  const canWrite = roleHasPermission(user.role, "plant-orders:write");

  const params = await searchParams;
  const page = parsePositiveInt(params.page) ?? 1;
  const accumulate = params.all === "1";
  const pageSize = PAGE_SIZES.includes(Number(params.filas))
    ? Number(params.filas)
    : PAGE_SIZE;
  const skip = accumulate ? 0 : (page - 1) * pageSize;
  const take = accumulate ? Math.min(page * pageSize, 300) : pageSize;

  /* El ORIGEN se fija aquí y no se lee de la URL: es lo que separa esta lista
     de Órdenes, y dejarlo viajar en los parámetros permitiría asomarse a las
     de la casa tecleando en la barra de direcciones. */
  const filters = { ...parseCuttingOrderFilters(params), origin: "PLANT" as const };
  const where = cuttingOrderWhere(filters);

  const [total, orders, options] = await Promise.all([
    prisma.cuttingOrder.count({ where }),
    prisma.cuttingOrder.findMany({
      where,
      /* Las que faltan por revisar primero: quien abre esta pantalla viene a
         decidir sobre lo nuevo, no a releer lo que ya agregó. Dentro de cada
         grupo, lo más reciente arriba. */
      orderBy: [
        { addedAt: { sort: "asc", nulls: "first" } },
        { orderedAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip,
      take,
      include: {
        client: { select: { name: true } },
        material: { select: { name: true } },
        folder: { select: { name: true } },
        lines: { select: { orderedQuantity: true, cutQuantity: true } },
        _count: { select: { comments: true } },
      },
    }),
    getOrderFormOptions(),
  ]);

  const rows = orders.map((order) => ({
    ...order,
    folderName: order.folder?.name ?? null,
  }));

  const isFiltered = Boolean(params.q || params.agregadas);
  const pending = await prisma.cuttingOrder.count({
    where: { origin: "PLANT", addedAt: null },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Órdenes de planta"
        description="Lo que pidió la otra planta"
        action={
          canWrite ? (
            <Button asChild className="touch-target">
              <Link href="/plant-orders/new">
                <Plus className="size-4" aria-hidden />
                Nueva
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* El pendiente va arriba y en una línea: es la única razón por la que
          quien administra abre esta pantalla. */}
      {canAdopt && pending > 0 && (
        <p className="flat-surface p-3 text-sm">
          <span className="tabular font-medium">{pending}</span>{" "}
          {pending === 1 ? "orden espera" : "órdenes esperan"} tu visto bueno
          para entrar al concentrado.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Folio, cliente, prenda…"
          className="flex-1 md:max-w-sm"
        />
      </div>

      <PlantOrderFilters />

      <PlantOrderTable
        orders={rows}
        server={{
          page,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          total,
          pageSize,
        }}
        folders={options.folders}
        canAdopt={canAdopt}
        isFiltered={isFiltered}
      />
    </div>
  );
}

/** Un entero positivo de la URL, o nada si viene cualquier otra cosa. */
function parsePositiveInt(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
