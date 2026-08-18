-- AlterTable
ALTER TABLE "document_cut_lines" ADD COLUMN     "tagId" TEXT;

-- CreateTable
CREATE TABLE "cut_tag_options" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cut_tag_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cut_tag_options_code_key" ON "cut_tag_options"("code");

-- CreateIndex
CREATE INDEX "cut_tag_options_active_order_idx" ON "cut_tag_options"("active", "order");

-- CreateIndex
CREATE INDEX "document_cut_lines_tagId_idx" ON "document_cut_lines"("tagId");

-- AddForeignKey
ALTER TABLE "document_cut_lines" ADD CONSTRAINT "document_cut_lines_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "cut_tag_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
