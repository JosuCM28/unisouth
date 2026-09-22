-- AlterTable
ALTER TABLE "garment_shipment_lines" ADD COLUMN     "tagId" TEXT;

-- AddForeignKey
ALTER TABLE "garment_shipment_lines" ADD CONSTRAINT "garment_shipment_lines_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "cut_tag_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
