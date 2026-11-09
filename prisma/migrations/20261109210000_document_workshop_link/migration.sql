-- AlterTable
ALTER TABLE "inventory_documents" ADD COLUMN     "workshopId" TEXT,
ADD COLUMN     "workshopReceivedAt" TIMESTAMP(3),
ADD COLUMN     "workshopReceivedById" TEXT;

-- CreateIndex
CREATE INDEX "inventory_documents_workshopId_status_idx" ON "inventory_documents"("workshopId", "status");

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_workshopReceivedById_fkey" FOREIGN KEY ("workshopReceivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

