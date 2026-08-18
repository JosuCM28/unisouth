-- CreateEnum
CREATE TYPE "CutTag" AS ENUM ('BLUE', 'GREEN', 'ORANGE', 'YELLOW', 'RED', 'PURPLE', 'PINK', 'BROWN', 'BLACK', 'WHITE');

-- CreateTable
CREATE TABLE "document_cut_lines" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "bundles" INTEGER NOT NULL DEFAULT 1,
    "tag" "CutTag",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_cut_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_cut_lines_documentId_idx" ON "document_cut_lines"("documentId");

-- CreateIndex
CREATE INDEX "document_cut_lines_sizeId_idx" ON "document_cut_lines"("sizeId");

-- AddForeignKey
ALTER TABLE "document_cut_lines" ADD CONSTRAINT "document_cut_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "inventory_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_cut_lines" ADD CONSTRAINT "document_cut_lines_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
