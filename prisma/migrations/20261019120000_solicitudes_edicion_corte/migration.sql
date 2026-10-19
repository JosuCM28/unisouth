-- CreateEnum
CREATE TYPE "CutEditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'USED');

-- CreateTable
CREATE TABLE "cut_edit_requests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "CutEditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "cut_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cut_edit_requests_status_createdAt_idx" ON "cut_edit_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "cut_edit_requests_orderId_requestedById_status_idx" ON "cut_edit_requests"("orderId", "requestedById", "status");

-- AddForeignKey
ALTER TABLE "cut_edit_requests" ADD CONSTRAINT "cut_edit_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "cutting_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cut_edit_requests" ADD CONSTRAINT "cut_edit_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cut_edit_requests" ADD CONSTRAINT "cut_edit_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

