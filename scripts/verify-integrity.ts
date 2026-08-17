import { prisma } from "@/lib/prisma";
import { round4 } from "@/lib/services/inventory.service";

/**
 * Verifica la regla que sostiene todo el sistema:
 *
 *   Lot.currentQuantity === Σ(Movement.quantity WHERE lotId = lot.id)
 *
 * Si un lote no cuadra, alguien escribió `currentQuantity` fuera de
 * InventoryService, o borró un movimiento que debía ser append-only.
 *
 * Correr con: npm run verify:integrity
 */

interface Mismatch {
  code: string;
  stored: number;
  fromMovements: number;
  difference: number;
  movementCount: number;
}

async function main() {
  console.log("Verificando integridad del inventario…\n");

  const [lots, sums] = await Promise.all([
    prisma.lot.findMany({
      select: { id: true, code: true, currentQuantity: true, unit: true },
      orderBy: { code: "asc" },
    }),
    // Una sola consulta agrupada en vez de una por lote: con 20 mil rollos,
    // 20 mil viajes a Neon tardarían más que toda la jornada.
    prisma.movement.groupBy({
      by: ["lotId"],
      _sum: { quantity: true },
      _count: { _all: true },
    }),
  ]);

  const byLot = new Map(
    sums.map((row) => [
      row.lotId,
      { sum: Number(row._sum.quantity ?? 0), count: row._count._all },
    ]),
  );

  const mismatches: Mismatch[] = [];
  const orphans: string[] = [];

  for (const lot of lots) {
    const entry = byLot.get(lot.id);
    const stored = round4(Number(lot.currentQuantity));
    const fromMovements = round4(entry?.sum ?? 0);

    // Un lote sin movimientos es sospechoso: hasta el alta genera un
    // RECEIPT_INITIAL. Sólo se acepta si su saldo es cero.
    if (!entry) {
      if (stored !== 0) orphans.push(lot.code);
      continue;
    }

    if (stored !== fromMovements) {
      mismatches.push({
        code: lot.code,
        stored,
        fromMovements,
        difference: round4(stored - fromMovements),
        movementCount: entry.count,
      });
    }
  }

  console.log(`Lotes revisados:      ${lots.length}`);
  console.log(`Movimientos totales:  ${sums.reduce((acc, r) => acc + r._count._all, 0)}`);
  console.log(`Lotes que cuadran:    ${lots.length - mismatches.length - orphans.length}`);

  if (orphans.length > 0) {
    console.log(`\n⚠  ${orphans.length} lote(s) con saldo pero SIN movimientos:`);
    orphans.forEach((code) => console.log(`   ${code}`));
  }

  if (mismatches.length === 0 && orphans.length === 0) {
    console.log("\n✓ Todo cuadra: cada saldo es la suma exacta de su kárdex.");
    return;
  }

  if (mismatches.length > 0) {
    console.log(`\n✗ ${mismatches.length} lote(s) NO cuadran:\n`);
    console.log("   FOLIO            GUARDADO      KÁRDEX    DIFERENCIA   MOVS");
    console.log("   " + "─".repeat(64));

    for (const m of mismatches) {
      console.log(
        `   ${m.code.padEnd(16)}${String(m.stored).padStart(9)}` +
          `${String(m.fromMovements).padStart(12)}` +
          `${String(m.difference).padStart(14)}` +
          `${String(m.movementCount).padStart(7)}`,
      );
    }

    console.log(
      "\n   Una diferencia aquí significa que alguien escribió currentQuantity",
      "\n   fuera de InventoryService, o que se borró un movimiento.",
    );
  }

  // Salida distinta de cero para que un CI o un cron lo detecte.
  hasProblems = true;
}

/** Se marca aquí y se aplica al final: process.exitCode se pierde si se
 *  asigna antes de que termine el $disconnect asíncrono. */
let hasProblems = false;

main()
  .catch((error) => {
    console.error("La verificación falló:", error);
    hasProblems = true;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(hasProblems ? 1 : 0);
  });
