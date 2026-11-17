-- CreateTable
CREATE TABLE "packing_list_sheets" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "formatCode" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "preparedBy" TEXT,
    "reviewedBy" TEXT,
    "receivedBy" TEXT,
    "notes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_list_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_list_sheet_lines" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "stockId" TEXT,
    "orderRef" TEXT,
    "destination" TEXT,
    "description" TEXT NOT NULL,
    "color" TEXT,
    "boxNumber" INTEGER,
    "size" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "packing_list_sheet_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_list_sheet_boxes" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "boxNumber" INTEGER NOT NULL,
    "weightKg" DECIMAL(8,2),
    "dimensions" TEXT,

    CONSTRAINT "packing_list_sheet_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packing_list_sheets_orderId_key" ON "packing_list_sheets"("orderId");

-- CreateIndex
CREATE INDEX "packing_list_sheet_lines_sheetId_position_idx" ON "packing_list_sheet_lines"("sheetId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "packing_list_sheet_boxes_sheetId_boxNumber_key" ON "packing_list_sheet_boxes"("sheetId", "boxNumber");

-- AddForeignKey
ALTER TABLE "packing_list_sheets" ADD CONSTRAINT "packing_list_sheets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "packing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_list_sheets" ADD CONSTRAINT "packing_list_sheets_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_list_sheet_lines" ADD CONSTRAINT "packing_list_sheet_lines_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "packing_list_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_list_sheet_boxes" ADD CONSTRAINT "packing_list_sheet_boxes_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "packing_list_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

