-- AlterTable
ALTER TABLE "cutting_batches" ADD COLUMN     "groupId" TEXT;

-- CreateIndex
CREATE INDEX "cutting_batches_groupId_idx" ON "cutting_batches"("groupId");
