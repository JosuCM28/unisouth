-- CreateEnum
CREATE TYPE "GarmentShipmentStatus" AS ENUM ('SENT', 'PARTIAL', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "workshops" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_stages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_shipments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "GarmentShipmentStatus" NOT NULL DEFAULT 'SENT',
    "orderId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reference" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garment_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_shipment_lines" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "sentQuantity" INTEGER NOT NULL,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "scrapQuantity" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "garment_shipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_returns" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "scrapQuantity" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garment_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workshops_code_key" ON "workshops"("code");

-- CreateIndex
CREATE UNIQUE INDEX "workshops_name_key" ON "workshops"("name");

-- CreateIndex
CREATE UNIQUE INDEX "process_stages_code_key" ON "process_stages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "process_stages_name_key" ON "process_stages"("name");

-- CreateIndex
CREATE UNIQUE INDEX "garment_shipments_code_key" ON "garment_shipments"("code");

-- CreateIndex
CREATE INDEX "garment_shipments_orderId_idx" ON "garment_shipments"("orderId");

-- CreateIndex
CREATE INDEX "garment_shipments_workshopId_status_idx" ON "garment_shipments"("workshopId", "status");

-- CreateIndex
CREATE INDEX "garment_shipments_stageId_idx" ON "garment_shipments"("stageId");

-- CreateIndex
CREATE INDEX "garment_shipment_lines_shipmentId_idx" ON "garment_shipment_lines"("shipmentId");

-- CreateIndex
CREATE INDEX "garment_shipment_lines_sizeId_idx" ON "garment_shipment_lines"("sizeId");

-- CreateIndex
CREATE INDEX "garment_returns_lineId_idx" ON "garment_returns"("lineId");

-- AddForeignKey
ALTER TABLE "garment_shipments" ADD CONSTRAINT "garment_shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "cutting_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_shipments" ADD CONSTRAINT "garment_shipments_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_shipments" ADD CONSTRAINT "garment_shipments_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "process_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_shipments" ADD CONSTRAINT "garment_shipments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_shipment_lines" ADD CONSTRAINT "garment_shipment_lines_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "garment_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_shipment_lines" ADD CONSTRAINT "garment_shipment_lines_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_returns" ADD CONSTRAINT "garment_returns_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "garment_shipment_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_returns" ADD CONSTRAINT "garment_returns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

