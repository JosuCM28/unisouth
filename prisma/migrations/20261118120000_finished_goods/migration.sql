-- CreateEnum
CREATE TYPE "FinishedMovementType" AS ENUM ('WORKSHOP_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'PACKED', 'UNPACKED');

-- CreateTable
CREATE TABLE "finished_stock" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientPo" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finished_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_movements" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "type" "FinishedMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finished_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finished_stock_key_key" ON "finished_stock"("key");

-- CreateIndex
CREATE INDEX "finished_stock_productId_idx" ON "finished_stock"("productId");

-- CreateIndex
CREATE INDEX "finished_stock_clientId_clientPo_idx" ON "finished_stock"("clientId", "clientPo");

-- CreateIndex
CREATE INDEX "finished_movements_stockId_createdAt_idx" ON "finished_movements"("stockId", "createdAt");

-- AddForeignKey
ALTER TABLE "finished_stock" ADD CONSTRAINT "finished_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "finished_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_stock" ADD CONSTRAINT "finished_stock_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_stock" ADD CONSTRAINT "finished_stock_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_movements" ADD CONSTRAINT "finished_movements_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "finished_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_movements" ADD CONSTRAINT "finished_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

