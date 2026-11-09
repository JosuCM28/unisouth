-- AlterTable
ALTER TABLE "inventory_documents" ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "dispatchedById" TEXT;

-- AlterTable
ALTER TABLE "garment_shipments" ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "dispatchedById" TEXT;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_shipments" ADD CONSTRAINT "garment_shipments_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

