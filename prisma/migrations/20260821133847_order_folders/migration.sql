-- AlterTable
ALTER TABLE "cutting_orders" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "order_folders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "reference" TEXT,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_folders_code_key" ON "order_folders"("code");

-- CreateIndex
CREATE INDEX "order_folders_archivedAt_createdAt_idx" ON "order_folders"("archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "order_folders_clientId_idx" ON "order_folders"("clientId");

-- CreateIndex
CREATE INDEX "cutting_orders_folderId_idx" ON "cutting_orders"("folderId");

-- AddForeignKey
ALTER TABLE "order_folders" ADD CONSTRAINT "order_folders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_folders" ADD CONSTRAINT "order_folders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "order_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
