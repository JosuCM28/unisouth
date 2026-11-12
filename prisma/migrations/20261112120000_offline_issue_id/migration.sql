-- AlterTable
ALTER TABLE "inventory_documents" ADD COLUMN     "offlineId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "inventory_documents_offlineId_key" ON "inventory_documents"("offlineId");

