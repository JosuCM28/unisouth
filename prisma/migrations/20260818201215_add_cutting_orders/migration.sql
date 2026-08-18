-- CreateEnum
CREATE TYPE "CuttingOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "cutting_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CuttingOrderStatus" NOT NULL DEFAULT 'OPEN',
    "clientId" TEXT,
    "materialId" TEXT,
    "productionRunId" TEXT,
    "description" TEXT,
    "reference" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cutting_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "orderedQuantity" INTEGER NOT NULL,
    "cutQuantity" INTEGER NOT NULL DEFAULT 0,
    "tagId" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cutting_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_progress" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cutting_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cutting_orders_code_key" ON "cutting_orders"("code");

-- CreateIndex
CREATE INDEX "cutting_orders_status_orderedAt_idx" ON "cutting_orders"("status", "orderedAt");

-- CreateIndex
CREATE INDEX "cutting_orders_clientId_idx" ON "cutting_orders"("clientId");

-- CreateIndex
CREATE INDEX "cutting_order_lines_orderId_idx" ON "cutting_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "cutting_order_lines_sizeId_idx" ON "cutting_order_lines"("sizeId");

-- CreateIndex
CREATE INDEX "cutting_progress_lineId_idx" ON "cutting_progress"("lineId");

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_order_lines" ADD CONSTRAINT "cutting_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "cutting_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_order_lines" ADD CONSTRAINT "cutting_order_lines_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_order_lines" ADD CONSTRAINT "cutting_order_lines_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "cut_tag_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_progress" ADD CONSTRAINT "cutting_progress_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "cutting_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_progress" ADD CONSTRAINT "cutting_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
