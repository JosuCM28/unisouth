import { prisma } from "@/lib/prisma";

/**
 * Catálogos que alimentan el formulario de órdenes.
 *
 * Vive aquí y no en la página porque son tres pantallas —alta, corrección y
 * ficha— y duplicarlo garantizaría que un día ofrezcan cosas distintas.
 */
export async function getOrderFormOptions() {
  const [clients, materials, productionRuns, sizes, tags] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.material.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.productionRun.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE"] } },
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.size.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, group: true },
      orderBy: { order: "asc" },
    }),
    prisma.cutTagOption.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true, color: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
  ]);

  return {
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
    materials: materials.map((m) => ({
      id: m.id,
      name: m.name,
      hint: m.code,
    })),
    productionRuns: productionRuns.map((r) => ({
      id: r.id,
      name: r.name ?? r.code,
      hint: r.name ? r.code : undefined,
    })),
    sizes,
    tags,
  };
}
