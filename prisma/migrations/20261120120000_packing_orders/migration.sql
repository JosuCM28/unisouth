-- CreateEnum
CREATE TYPE "PackingOrderStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "finished_movements" ADD COLUMN     "packingBoxId" TEXT;

-- CreateTable
CREATE TABLE "packing_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PackingOrderStatus" NOT NULL DEFAULT 'OPEN',
    "clientId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_boxes" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packing_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_box_lines" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "packing_box_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packing_orders_code_key" ON "packing_orders"("code");

-- CreateIndex
CREATE INDEX "packing_orders_status_date_idx" ON "packing_orders"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "packing_boxes_orderId_number_key" ON "packing_boxes"("orderId", "number");

-- CreateIndex
CREATE INDEX "packing_box_lines_stockId_idx" ON "packing_box_lines"("stockId");

-- CreateIndex
CREATE UNIQUE INDEX "packing_box_lines_boxId_stockId_key" ON "packing_box_lines"("boxId", "stockId");

-- CreateIndex
CREATE INDEX "finished_movements_packingBoxId_idx" ON "finished_movements"("packingBoxId");

-- AddForeignKey
ALTER TABLE "finished_movements" ADD CONSTRAINT "finished_movements_packingBoxId_fkey" FOREIGN KEY ("packingBoxId") REFERENCES "packing_boxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_boxes" ADD CONSTRAINT "packing_boxes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "packing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_box_lines" ADD CONSTRAINT "packing_box_lines_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "packing_boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_box_lines" ADD CONSTRAINT "packing_box_lines_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "finished_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

