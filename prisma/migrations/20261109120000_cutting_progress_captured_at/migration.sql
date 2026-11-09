-- AlterTable
ALTER TABLE "cutting_progress" ADD COLUMN     "capturedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "cutting_progress_capturedAt_idx" ON "cutting_progress"("capturedAt");

