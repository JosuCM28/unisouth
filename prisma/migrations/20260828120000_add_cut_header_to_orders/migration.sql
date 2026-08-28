-- AlterTable
ALTER TABLE "cutting_orders" ADD COLUMN     "cutFabricText" TEXT,
ADD COLUMN     "cutNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cutPattern" TEXT,
ADD COLUMN     "cutVersion" "CutVersion",
ADD COLUMN     "cutVersionNotes" TEXT;
