-- Alcance de lo que se habia aplicado con `prisma db push`.
--
-- Estos cambios YA estan en la base: entraron uno por uno por db push y
-- ninguno quedo escrito como migration, asi que la historia no producia el
-- esquema real y `migrate dev` solo podia ofrecer resetear.
--
-- Se registra con `migrate resolve --applied`, NO se ejecuta: correrlo sobre
-- la base que ya los tiene reventaria en el primer CREATE TYPE.

-- CreateEnum
CREATE TYPE "CuttingOrderOrigin" AS ENUM ('HOUSE', 'PLANT');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "cuttingOrderId" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "cutting_orders" ADD COLUMN     "addedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "addedById" TEXT,
ADD COLUMN     "origin" "CuttingOrderOrigin" NOT NULL DEFAULT 'HOUSE';

-- AlterTable
ALTER TABLE "inventory_documents" ADD COLUMN     "orderFolderId" TEXT;

-- CreateTable
CREATE TABLE "_DocumentSentBatches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DocumentSentBatches_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DocumentSentBatches_B_index" ON "_DocumentSentBatches"("B");

-- CreateIndex
CREATE INDEX "attachments_cuttingOrderId_idx" ON "attachments"("cuttingOrderId");

-- CreateIndex
CREATE INDEX "cutting_orders_origin_addedAt_idx" ON "cutting_orders"("origin", "addedAt");

-- CreateIndex
CREATE INDEX "inventory_documents_orderFolderId_idx" ON "inventory_documents"("orderFolderId");

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_orderFolderId_fkey" FOREIGN KEY ("orderFolderId") REFERENCES "order_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_cuttingOrderId_fkey" FOREIGN KEY ("cuttingOrderId") REFERENCES "cutting_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentSentBatches" ADD CONSTRAINT "_DocumentSentBatches_A_fkey" FOREIGN KEY ("A") REFERENCES "cutting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentSentBatches" ADD CONSTRAINT "_DocumentSentBatches_B_fkey" FOREIGN KEY ("B") REFERENCES "inventory_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

