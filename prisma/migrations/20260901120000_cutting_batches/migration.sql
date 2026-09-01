-- Cortes por tanda ("1er corte", "2º corte") en las órdenes.
--
-- Va escrita a mano y en cuatro pasos porque hay avances YA capturados en
-- producción: `cutting_progress.batchId` es NOT NULL, y agregar la columna
-- directamente reventaría contra esas filas. Primero se crean los cortes, luego
-- se rellenan las filas viejas y sólo al final se exige la columna.

-- CreateTable
CREATE TABLE "cutting_batches" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cutting_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cutting_batches_orderId_number_key" ON "cutting_batches"("orderId", "number");

-- CreateIndex
CREATE INDEX "cutting_batches_orderId_idx" ON "cutting_batches"("orderId");

-- AddForeignKey
ALTER TABLE "cutting_batches" ADD CONSTRAINT "cutting_batches_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "cutting_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_batches" ADD CONSTRAINT "cutting_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: el corte #1 de cada orden que ya traía avances.
--
-- `openedAt` toma la fecha del avance MÁS VIEJO de la orden y no `now()`: el
-- corte ocurrió cuando ocurrió, y sellarlo con la fecha de la migración haría
-- que toda orden vieja pareciera cortada el día del despliegue.
--
-- `createdById` queda nulo a propósito: nadie abrió este corte, lo dedujo la
-- migración, y firmarlo con un usuario sería inventar quién estuvo ahí.
INSERT INTO "cutting_batches" ("id", "orderId", "number", "notes", "openedAt", "createdAt")
SELECT
    gen_random_uuid()::text,
    o."id",
    1,
    'Avances capturados antes de que existieran los cortes.',
    MIN(p."createdAt"),
    MIN(p."createdAt")
FROM "cutting_orders" o
JOIN "cutting_order_lines" l ON l."orderId" = o."id"
JOIN "cutting_progress" p ON p."lineId" = l."id"
GROUP BY o."id";

-- AlterTable: nullable primero, para poder rellenarla.
ALTER TABLE "cutting_progress" ADD COLUMN "batchId" TEXT;

UPDATE "cutting_progress" p
SET "batchId" = b."id"
FROM "cutting_order_lines" l, "cutting_batches" b
WHERE p."lineId" = l."id"
  AND b."orderId" = l."orderId"
  AND b."number" = 1;

-- Ya sin filas huérfanas: todo avance pertenece a un corte.
ALTER TABLE "cutting_progress" ALTER COLUMN "batchId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "cutting_progress_batchId_idx" ON "cutting_progress"("batchId");

-- AddForeignKey
-- RESTRICT y no CASCADE: borrar un corte no puede llevarse por delante el
-- historial de lo que se cortó en él. Un corte con avances no se borra.
ALTER TABLE "cutting_progress" ADD CONSTRAINT "cutting_progress_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "cutting_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
