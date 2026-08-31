-- AlterTable
ALTER TABLE "garment_shipments" ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "parts" TEXT;

-- CreateIndex
CREATE INDEX "garment_shipments_documentId_idx" ON "garment_shipments"("documentId");

-- AddForeignKey
ALTER TABLE "garment_shipments" ADD CONSTRAINT "garment_shipments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "inventory_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

