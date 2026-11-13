-- AlterEnum
ALTER TYPE "FinishedMovementType" ADD VALUE 'WORKSHOP_IN_REVERSAL';

-- AlterTable
ALTER TABLE "workshop_outputs" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "workshop_output_lines" ADD COLUMN     "clientPo" TEXT;

-- AlterTable
ALTER TABLE "finished_movements" ADD COLUMN     "workshopOutputId" TEXT;

-- CreateIndex
CREATE INDEX "finished_movements_workshopOutputId_idx" ON "finished_movements"("workshopOutputId");

-- AddForeignKey
ALTER TABLE "workshop_outputs" ADD CONSTRAINT "workshop_outputs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "finished_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_outputs" ADD CONSTRAINT "workshop_outputs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_movements" ADD CONSTRAINT "finished_movements_workshopOutputId_fkey" FOREIGN KEY ("workshopOutputId") REFERENCES "workshop_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

