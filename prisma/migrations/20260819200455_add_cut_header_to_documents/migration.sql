-- CreateEnum
CREATE TYPE "CutVersion" AS ENUM ('UNIQUE', 'V1', 'V2', 'V3', 'V4', 'V5');

-- AlterTable
ALTER TABLE "inventory_documents" ADD COLUMN     "cutDescription" TEXT,
ADD COLUMN     "cutFabricId" TEXT,
ADD COLUMN     "cutFabricText" TEXT,
ADD COLUMN     "cutNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cutPattern" TEXT,
ADD COLUMN     "cutVersion" "CutVersion",
ADD COLUMN     "cutVersionNotes" TEXT;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_cutFabricId_fkey" FOREIGN KEY ("cutFabricId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
