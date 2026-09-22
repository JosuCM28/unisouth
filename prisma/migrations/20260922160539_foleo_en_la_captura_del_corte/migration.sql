-- AlterTable
ALTER TABLE "cutting_progress" ADD COLUMN     "tagId" TEXT;

-- AddForeignKey
ALTER TABLE "cutting_progress" ADD CONSTRAINT "cutting_progress_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "cut_tag_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
