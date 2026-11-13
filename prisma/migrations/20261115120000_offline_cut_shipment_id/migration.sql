-- AlterTable
ALTER TABLE "cutting_batches" ADD COLUMN     "offlineId" TEXT;

-- AlterTable
ALTER TABLE "garment_shipments" ADD COLUMN     "offlineId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cutting_batches_offlineId_key" ON "cutting_batches"("offlineId");

-- CreateIndex
CREATE UNIQUE INDEX "garment_shipments_offlineId_key" ON "garment_shipments"("offlineId");
