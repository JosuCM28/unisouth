-- CreateEnum
CREATE TYPE "WorkshopKind" AS ENUM ('PROCESS', 'ASSEMBLY');

-- CreateEnum
CREATE TYPE "WorkshopOutputType" AS ENUM ('PROCESSED', 'FINISHED');

-- AlterTable
ALTER TABLE "workshops" ADD COLUMN     "kind" "WorkshopKind" NOT NULL DEFAULT 'PROCESS';

-- CreateTable
CREATE TABLE "workshop_outputs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "WorkshopOutputType" NOT NULL DEFAULT 'PROCESSED',
    "workshopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "destinationWorkshopId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parts" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_output_lines" (
    "id" TEXT NOT NULL,
    "outputId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "scrapQuantity" INTEGER NOT NULL DEFAULT 0,
    "scrapReason" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workshop_output_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workshop_outputs_code_key" ON "workshop_outputs"("code");

-- CreateIndex
CREATE INDEX "workshop_outputs_workshopId_cancelledAt_idx" ON "workshop_outputs"("workshopId", "cancelledAt");

-- CreateIndex
CREATE INDEX "workshop_outputs_orderId_idx" ON "workshop_outputs"("orderId");

-- CreateIndex
CREATE INDEX "workshop_outputs_destinationWorkshopId_idx" ON "workshop_outputs"("destinationWorkshopId");

-- CreateIndex
CREATE INDEX "workshop_output_lines_outputId_idx" ON "workshop_output_lines"("outputId");

-- CreateIndex
CREATE INDEX "workshop_output_lines_sizeId_idx" ON "workshop_output_lines"("sizeId");

-- AddForeignKey
ALTER TABLE "workshop_outputs" ADD CONSTRAINT "workshop_outputs_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_outputs" ADD CONSTRAINT "workshop_outputs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_outputs" ADD CONSTRAINT "workshop_outputs_destinationWorkshopId_fkey" FOREIGN KEY ("destinationWorkshopId") REFERENCES "workshops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_outputs" ADD CONSTRAINT "workshop_outputs_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_outputs" ADD CONSTRAINT "workshop_outputs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_output_lines" ADD CONSTRAINT "workshop_output_lines_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "workshop_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_output_lines" ADD CONSTRAINT "workshop_output_lines_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Datos ────────────────────────────────────────────────────────────────
-- Acatlán y Allende confeccionan; los demás (Sitex, Broderie y los que no
-- tienen cuenta) quedan como talleres de proceso. Se corrige desde Talleres.
UPDATE "workshops"
SET "kind" = 'ASSEMBLY'
WHERE "accessRole" IN ('WORKSHOP_ACATLAN', 'WORKSHOP_ALLENDE');
