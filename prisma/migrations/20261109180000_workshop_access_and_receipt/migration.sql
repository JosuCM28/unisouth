-- AlterTable
ALTER TABLE "workshops" ADD COLUMN     "accessRole" TEXT,
ADD COLUMN     "accessSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "garment_shipments" ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "workshops_accessRole_key" ON "workshops"("accessRole");

-- AddForeignKey
ALTER TABLE "garment_shipments" ADD CONSTRAINT "garment_shipments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

