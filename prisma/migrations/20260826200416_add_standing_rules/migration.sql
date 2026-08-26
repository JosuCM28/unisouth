-- CreateEnum
CREATE TYPE "StandingRuleTopic" AS ENUM ('CUTTING', 'SEWING', 'QUALITY', 'PACKAGING', 'DELIVERY', 'MATERIAL', 'GENERAL');

-- CreateTable
CREATE TABLE "standing_rules" (
    "id" TEXT NOT NULL,
    "topic" "StandingRuleTopic" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "clientId" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standing_rules_clientId_active_idx" ON "standing_rules"("clientId", "active");

-- CreateIndex
CREATE INDEX "standing_rules_active_position_idx" ON "standing_rules"("active", "position");

-- AddForeignKey
ALTER TABLE "standing_rules" ADD CONSTRAINT "standing_rules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
