-- AlterTable
ALTER TABLE "cutting_orders" ADD COLUMN     "clientPo" TEXT,
ADD COLUMN     "metersDelivered" DECIMAL(12,2),
ADD COLUMN     "metersSpread" DECIMAL(12,2),
ADD COLUMN     "smallRemnant" DECIMAL(12,2);
