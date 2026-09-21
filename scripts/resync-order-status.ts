import { prisma } from "@/lib/prisma";
import { cutTotals } from "@/lib/utils";

/**
 * Recalcula el estado de las órdenes de corte con la regla buena: TERMINADA es
 * que ninguna talla quede corta.
 *
 * Existe por una corrección puntual. Hasta hoy `syncStatus` comparaba el neto
 * —`cortadas >= pedidas` sumando toda la orden—, así que el excedente de una
 * talla tapaba el faltante de otra: una orden con 780 piezas de más en las
 * grandes y 585 sin cortar en las chicas se marcaba COMPLETED, se le sellaba
 * `closedAt` y desaparecía del pendiente. El código ya no lo hace, pero las
 * órdenes que se cerraron así siguen mintiendo hasta que algo las toque.
 *
 * NO toca las canceladas: cancelar es una decisión de alguien, no un estado
 * derivado del avance, y volver a abrirlas desde aquí sería pasarle por encima.
 *
 * Correr con: npm run resync:orders  (con `--apply` para escribir)
 */

interface Change {
  code: string;
  from: string;
  to: string;
  ordered: number;
  cut: number;
  pending: number;
  surplus: number;
}

/** La misma regla que `CuttingOrderService.syncStatus`. */
function statusFromProgress(cut: number, pending: number) {
  if (cut === 0) return "OPEN";
  if (pending === 0) return "COMPLETED";
  return "IN_PROGRESS";
}

async function main() {
  const apply = process.argv.includes("--apply");

  console.log(
    apply
      ? "Resincronizando el estado de las órdenes…\n"
      : "Revisando el estado de las órdenes (simulacro, nada se escribe)…\n",
  );

  const orders = await prisma.cuttingOrder.findMany({
    where: { status: { not: "CANCELLED" } },
    select: {
      id: true,
      code: true,
      status: true,
      lines: { select: { orderedQuantity: true, cutQuantity: true } },
    },
    orderBy: { code: "asc" },
  });

  const changes: Change[] = [];

  for (const order of orders) {
    const { ordered, cut, pending, surplus } = cutTotals(order.lines);
    const status = statusFromProgress(cut, pending);

    if (status === order.status) continue;

    changes.push({
      code: order.code,
      from: order.status,
      to: status,
      ordered,
      cut,
      pending,
      surplus,
    });

    if (!apply) continue;

    await prisma.cuttingOrder.update({
      where: { id: order.id },
      data: {
        status,
        // Misma regla que el servicio: la fecha de cierre se limpia si la
        // orden vuelve a estar viva. Una fecha de cierre en una orden abierta
        // es justo la clase de dato que nadie vuelve a creerse.
        closedAt: status === "COMPLETED" ? new Date() : null,
      },
    });
  }

  if (changes.length === 0) {
    console.log("✓ Todas las órdenes ya están en el estado que les toca.");
    return;
  }

  console.log(
    `${changes.length} ${changes.length === 1 ? "orden" : "órdenes"} ` +
      `${apply ? "corregidas" : "por corregir"}:\n`,
  );
  console.log(
    "   Orden           Antes          Ahora        Pedidas   Cortadas" +
      "     Faltan     Sobran",
  );

  for (const change of changes) {
    console.log(
      `   ${change.code.padEnd(16)}${change.from.padEnd(15)}` +
        `${change.to.padEnd(13)}` +
        `${String(change.ordered).padStart(8)}` +
        `${String(change.cut).padStart(11)}` +
        `${String(change.pending).padStart(11)}` +
        `${String(change.surplus).padStart(11)}`,
    );
  }

  if (!apply) {
    console.log("\n   Nada se escribió. Vuelve a correrlo con --apply.");
  }
}

main()
  .catch((error) => {
    console.error("La resincronización falló:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
