-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPLY', 'CANCEL', 'RECALCULATE', 'APPROVE', 'PRINT', 'EXPORT', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT');

-- CreateEnum
CREATE TYPE "Sensitivity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('ROW', 'RACK', 'PALLET', 'FLOOR', 'SHELF', 'REMNANTS', 'QUARANTINE', 'TRANSIT');

-- CreateEnum
CREATE TYPE "ProductionRunStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('FABRIC', 'ZIPPER', 'BUTTON', 'THREAD', 'ELASTIC', 'LABEL', 'SNAP', 'TAPE', 'DRAWSTRING', 'INTERLINING', 'PACKAGING', 'OTHER');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('METER', 'SQUARE_METER', 'YARD', 'KILOGRAM', 'GRAM', 'PIECE', 'PAIR', 'CONE', 'ROLL', 'BOX', 'PACK', 'GROSS', 'THOUSAND', 'LITER');

-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('SUPPLIER_LABEL', 'MEASURED', 'ESTIMATED_WEIGHT', 'ESTIMATED_VISUAL', 'PHYSICAL_COUNT');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'IN_USE', 'REMNANT', 'DEPLETED', 'QUARANTINE', 'DEFECTIVE', 'RETURNED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'PRODUCTION_RETURN', 'SUPPLIER_RETURN', 'WRITE_OFF', 'COUNT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECEIPT_PURCHASE', 'RECEIPT_PRODUCTION_RETURN', 'RECEIPT_ADJUSTMENT', 'RECEIPT_TRANSFER', 'RECEIPT_INITIAL', 'ISSUE_PRODUCTION', 'ISSUE_SAMPLE', 'ISSUE_SCRAP', 'ISSUE_SUPPLIER_RETURN', 'ISSUE_ADJUSTMENT', 'ISSUE_TRANSFER', 'ISSUE_WRITE_OFF', 'RECLASSIFICATION', 'RECOUNT');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CountType" AS ENUM ('CYCLE', 'FULL', 'BY_LOCATION', 'BY_CLIENT', 'SPOT_CHECK');

-- CreateEnum
CREATE TYPE "CountStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'UNDER_REVIEW', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CountLineResult" AS ENUM ('PENDING', 'OK', 'MISSING', 'EXTRA', 'WRONG_LOCATION', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('SIMULATION', 'PLANNING', 'QUOTE');

-- CreateEnum
CREATE TYPE "CalculationStatus" AS ENUM ('DRAFT', 'CALCULATED', 'RESERVED', 'CONVERTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'PLANNED', 'MATERIAL_RESERVED', 'MATERIAL_ISSUED', 'IN_PROGRESS', 'FINISHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DECIMAL', 'DATE', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'URL');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PHOTO', 'ORIGINAL_LABEL', 'GUIDE', 'INVOICE', 'CERTIFICATE', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "phone" TEXT,
    "pinHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" "AuditAction" NOT NULL,
    "reference" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedFields" TEXT[],
    "sensitivity" "Sensitivity" NOT NULL DEFAULT 'LOW',
    "reason" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'ROW',
    "order" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "lotCapacity" INTEGER,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helpers" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helpers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_runs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "season" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ProductionRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carriers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "trackingUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "subtype" TEXT,
    "description" TEXT,
    "baseUnit" "Unit" NOT NULL,
    "purchaseUnit" "Unit",
    "purchaseFactor" DECIMAL(14,6),
    "composition" TEXT,
    "colorName" TEXT,
    "colorHex" TEXT,
    "widthMm" INTEGER,
    "thicknessMm" DECIMAL(8,3),
    "weightOz" DECIMAL(6,2),
    "gsm" DECIMAL(8,2),
    "shrinkagePct" DECIMAL(5,2),
    "finish" TEXT,
    "minStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "remnantThreshold" DECIMAL(14,4),
    "requiresShade" BOOLEAN NOT NULL DEFAULT false,
    "lotControlled" BOOLEAN NOT NULL DEFAULT true,
    "lastCost" DECIMAL(14,4),
    "costCurrency" TEXT NOT NULL DEFAULT 'MXN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "extras" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_substitutes" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "substituteId" TEXT NOT NULL,
    "factor" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_substitutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_materials" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierCode" TEXT,
    "price" DECIMAL(14,4),
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "leadTimeDays" INTEGER,
    "minOrderQty" DECIMAL(14,4),
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_tags" (
    "materialId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "material_tags_pkey" PRIMARY KEY ("materialId","tagId")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "guideNumber" TEXT,
    "carrierId" TEXT,
    "origin" TEXT,
    "supplierId" TEXT,
    "clientId" TEXT,
    "invoiceRef" TEXT,
    "orderRef" TEXT,
    "purchaseRequestId" TEXT,
    "packageCount" INTEGER,
    "totalWeightKg" DECIMAL(14,4),
    "notes" TEXT,
    "extras" JSONB,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "receiptId" TEXT,
    "clientId" TEXT,
    "productionRunId" TEXT,
    "locationId" TEXT,
    "supplierLotNumber" TEXT,
    "shade" TEXT,
    "colorText" TEXT,
    "actualWidthMm" INTEGER,
    "actualThicknessMm" DECIMAL(8,3),
    "actualWeightOz" DECIMAL(6,2),
    "weightKg" DECIMAL(14,4),
    "unit" "Unit" NOT NULL,
    "initialQuantity" DECIMAL(14,4) NOT NULL,
    "currentQuantity" DECIMAL(14,4) NOT NULL,
    "reservedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "measurementSource" "MeasurementSource" NOT NULL DEFAULT 'SUPPLIER_LABEL',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isRemnant" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "unitCost" DECIMAL(14,4),
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "parentLotId" TEXT,
    "comment" TEXT,
    "extras" JSONB,
    "helperId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_documents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT,
    "productionRunId" TEXT,
    "productionOrderId" TEXT,
    "concept" TEXT,
    "reference" TEXT,
    "handedOverBy" TEXT,
    "receivedBy" TEXT,
    "notes" TEXT,
    "extras" JSONB,
    "createdById" TEXT,
    "appliedById" TEXT,
    "appliedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_lines" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lotId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" "Unit" NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "remainingQuantity" DECIMAL(14,4),
    "createsRemnant" BOOLEAN NOT NULL DEFAULT false,
    "remnantLotId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" "Unit" NOT NULL,
    "balanceBefore" DECIMAL(14,4) NOT NULL,
    "balanceAfter" DECIMAL(14,4) NOT NULL,
    "documentId" TEXT,
    "productionRunId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "unitCost" DECIMAL(14,4),
    "reason" TEXT,
    "reversesId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "productionRunId" TEXT,
    "calculationId" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" "Unit" NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "validUntil" TIMESTAMP(3),
    "createdById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "type" "CountType" NOT NULL DEFAULT 'CYCLE',
    "status" "CountStatus" NOT NULL DEFAULT 'OPEN',
    "locationId" TEXT,
    "clientId" TEXT,
    "materialType" "MaterialType",
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "responsibleId" TEXT,
    "totalExpected" INTEGER,
    "totalCounted" INTEGER,
    "totalMissing" INTEGER,
    "totalExtra" INTEGER,
    "quantityVariance" DECIMAL(14,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "count_lines" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "systemQuantity" DECIMAL(14,4) NOT NULL,
    "countedQuantity" DECIMAL(14,4),
    "variance" DECIMAL(14,4),
    "expectedLocationId" TEXT,
    "foundLocationId" TEXT,
    "result" "CountLineResult" NOT NULL DEFAULT 'PENDING',
    "adjustmentApplied" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "countedById" TEXT,
    "countedAt" TIMESTAMP(3),

    CONSTRAINT "count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "category" TEXT,
    "unit" "Unit" NOT NULL DEFAULT 'PIECE',
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "extras" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finished_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sizes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "consumptionFactor" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "group" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeId" TEXT,
    "color" TEXT,
    "consumptionFactorOverride" DECIMAL(8,4),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "extras" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills_of_materials" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT,
    "status" "BomStatus" NOT NULL DEFAULT 'DRAFT',
    "globalWastePct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "extras" JSONB,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_lines" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "materialId" TEXT NOT NULL,
    "consumptionPerUnit" DECIMAL(14,6) NOT NULL,
    "unit" "Unit" NOT NULL,
    "wastePct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "sizeId" TEXT,
    "isFixedQuantity" BOOLEAN NOT NULL DEFAULT false,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "part" TEXT,
    "notes" TEXT,
    "extras" JSONB,

    CONSTRAINT "bom_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "type" "CalculationType" NOT NULL DEFAULT 'SIMULATION',
    "status" "CalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT,
    "productionRunId" TEXT,
    "respectOwnership" BOOLEAN NOT NULL DEFAULT true,
    "includeRemnants" BOOLEAN NOT NULL DEFAULT true,
    "safetyFactorPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "neededByDate" TIMESTAMP(3),
    "notes" TEXT,
    "extras" JSONB,
    "totalUnits" INTEGER,
    "estimatedCost" DECIMAL(14,4),
    "hasShortages" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_lines" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "sizeId" TEXT,
    "bomId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "appliedFactor" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calculation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_requirements" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "baseQuantity" DECIMAL(14,4) NOT NULL,
    "appliedWastePct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "requiredQuantity" DECIMAL(14,4) NOT NULL,
    "totalStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "reservedStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "availableStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "remnantStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "inTransit" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "shortage" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "sufficient" BOOLEAN NOT NULL DEFAULT true,
    "unitCost" DECIMAL(14,4),
    "estimatedCost" DECIMAL(14,4),
    "suggestedLots" JSONB,
    "warnings" TEXT[],
    "notes" TEXT,

    CONSTRAINT "calculation_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT,
    "productionRunId" TEXT,
    "calculationId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "neededBy" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "requestedBy" TEXT,
    "notes" TEXT,
    "extras" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_lines" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "sizeId" TEXT,
    "bomId" TEXT,
    "plannedQuantity" INTEGER NOT NULL,
    "producedQuantity" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "production_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "calculationId" TEXT,
    "supplierId" TEXT,
    "clientId" TEXT,
    "productionRunId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "neededBy" TIMESTAMP(3),
    "justification" TEXT,
    "notes" TEXT,
    "extras" JSONB,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "estimatedTotal" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_lines" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "requestedQuantity" DECIMAL(14,4) NOT NULL,
    "approvedQuantity" DECIMAL(14,4),
    "receivedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "unit" "Unit" NOT NULL,
    "estimatedPrice" DECIMAL(14,4),
    "specification" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "options" TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "group" TEXT,
    "helpText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "group" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "sequences" (
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "type" "AttachmentType" NOT NULL DEFAULT 'PHOTO',
    "lotId" TEXT,
    "receiptId" TEXT,
    "documentId" TEXT,
    "purchaseRequestId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_active_role_idx" ON "user"("active", "role");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_createdAt_idx" ON "audit_logs"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_sensitivity_createdAt_idx" ON "audit_logs"("sensitivity", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_reference_idx" ON "audit_logs"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_active_idx" ON "warehouses"("active");

-- CreateIndex
CREATE INDEX "locations_warehouseId_active_idx" ON "locations"("warehouseId", "active");

-- CreateIndex
CREATE INDEX "locations_type_active_idx" ON "locations"("type", "active");

-- CreateIndex
CREATE INDEX "locations_order_idx" ON "locations"("order");

-- CreateIndex
CREATE UNIQUE INDEX "locations_warehouseId_code_key" ON "locations"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "helpers_code_key" ON "helpers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "helpers_name_key" ON "helpers"("name");

-- CreateIndex
CREATE INDEX "helpers_active_idx" ON "helpers"("active");

-- CreateIndex
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE INDEX "clients_active_idx" ON "clients"("active");

-- CreateIndex
CREATE UNIQUE INDEX "production_runs_code_key" ON "production_runs"("code");

-- CreateIndex
CREATE INDEX "production_runs_clientId_status_idx" ON "production_runs"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "carriers_name_key" ON "carriers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE INDEX "materials_type_active_idx" ON "materials"("type", "active");

-- CreateIndex
CREATE INDEX "materials_name_idx" ON "materials"("name");

-- CreateIndex
CREATE INDEX "materials_colorName_idx" ON "materials"("colorName");

-- CreateIndex
CREATE UNIQUE INDEX "material_substitutes_materialId_substituteId_key" ON "material_substitutes"("materialId", "substituteId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_materials_materialId_supplierId_key" ON "supplier_materials"("materialId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_code_key" ON "receipts"("code");

-- CreateIndex
CREATE INDEX "receipts_date_idx" ON "receipts"("date");

-- CreateIndex
CREATE INDEX "receipts_guideNumber_idx" ON "receipts"("guideNumber");

-- CreateIndex
CREATE INDEX "receipts_clientId_date_idx" ON "receipts"("clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "lots_code_key" ON "lots"("code");

-- CreateIndex
CREATE INDEX "lots_materialId_status_idx" ON "lots"("materialId", "status");

-- CreateIndex
CREATE INDEX "lots_locationId_status_idx" ON "lots"("locationId", "status");

-- CreateIndex
CREATE INDEX "lots_clientId_productionRunId_idx" ON "lots"("clientId", "productionRunId");

-- CreateIndex
CREATE INDEX "lots_materialId_shade_status_idx" ON "lots"("materialId", "shade", "status");

-- CreateIndex
CREATE INDEX "lots_supplierLotNumber_idx" ON "lots"("supplierLotNumber");

-- CreateIndex
CREATE INDEX "lots_isRemnant_materialId_idx" ON "lots"("isRemnant", "materialId");

-- CreateIndex
CREATE INDEX "lots_verified_idx" ON "lots"("verified");

-- CreateIndex
CREATE INDEX "lots_receivedAt_idx" ON "lots"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_documents_code_key" ON "inventory_documents"("code");

-- CreateIndex
CREATE INDEX "inventory_documents_type_status_date_idx" ON "inventory_documents"("type", "status", "date");

-- CreateIndex
CREATE INDEX "inventory_documents_date_idx" ON "inventory_documents"("date");

-- CreateIndex
CREATE INDEX "inventory_documents_productionRunId_idx" ON "inventory_documents"("productionRunId");

-- CreateIndex
CREATE INDEX "document_lines_documentId_idx" ON "document_lines"("documentId");

-- CreateIndex
CREATE INDEX "document_lines_lotId_idx" ON "document_lines"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "movements_code_key" ON "movements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "movements_reversesId_key" ON "movements"("reversesId");

-- CreateIndex
CREATE INDEX "movements_lotId_createdAt_idx" ON "movements"("lotId", "createdAt");

-- CreateIndex
CREATE INDEX "movements_materialId_createdAt_idx" ON "movements"("materialId", "createdAt");

-- CreateIndex
CREATE INDEX "movements_type_createdAt_idx" ON "movements"("type", "createdAt");

-- CreateIndex
CREATE INDEX "movements_productionRunId_createdAt_idx" ON "movements"("productionRunId", "createdAt");

-- CreateIndex
CREATE INDEX "movements_userId_createdAt_idx" ON "movements"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "movements_createdAt_idx" ON "movements"("createdAt");

-- CreateIndex
CREATE INDEX "reservations_lotId_status_idx" ON "reservations"("lotId", "status");

-- CreateIndex
CREATE INDEX "reservations_productionOrderId_status_idx" ON "reservations"("productionOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "counts_code_key" ON "counts"("code");

-- CreateIndex
CREATE INDEX "counts_status_startedAt_idx" ON "counts"("status", "startedAt");

-- CreateIndex
CREATE INDEX "count_lines_countId_result_idx" ON "count_lines"("countId", "result");

-- CreateIndex
CREATE UNIQUE INDEX "count_lines_countId_lotId_key" ON "count_lines"("countId", "lotId");

-- CreateIndex
CREATE UNIQUE INDEX "finished_products_code_key" ON "finished_products"("code");

-- CreateIndex
CREATE INDEX "finished_products_active_category_idx" ON "finished_products"("active", "category");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_code_key" ON "sizes"("code");

-- CreateIndex
CREATE INDEX "sizes_group_order_idx" ON "sizes"("group", "order");

-- CreateIndex
CREATE UNIQUE INDEX "variants_sku_key" ON "variants"("sku");

-- CreateIndex
CREATE INDEX "variants_productId_active_idx" ON "variants"("productId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "variants_productId_sizeId_color_key" ON "variants"("productId", "sizeId", "color");

-- CreateIndex
CREATE INDEX "bills_of_materials_productId_status_idx" ON "bills_of_materials"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bills_of_materials_productId_version_key" ON "bills_of_materials"("productId", "version");

-- CreateIndex
CREATE INDEX "bom_lines_bomId_order_idx" ON "bom_lines"("bomId", "order");

-- CreateIndex
CREATE INDEX "bom_lines_materialId_idx" ON "bom_lines"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "bom_lines_bomId_materialId_sizeId_part_key" ON "bom_lines"("bomId", "materialId", "sizeId", "part");

-- CreateIndex
CREATE UNIQUE INDEX "calculations_code_key" ON "calculations"("code");

-- CreateIndex
CREATE INDEX "calculations_status_createdAt_idx" ON "calculations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "calculations_clientId_idx" ON "calculations"("clientId");

-- CreateIndex
CREATE INDEX "calculation_lines_calculationId_idx" ON "calculation_lines"("calculationId");

-- CreateIndex
CREATE INDEX "calculation_requirements_calculationId_sufficient_idx" ON "calculation_requirements"("calculationId", "sufficient");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_requirements_calculationId_materialId_key" ON "calculation_requirements"("calculationId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_code_key" ON "production_orders"("code");

-- CreateIndex
CREATE INDEX "production_orders_status_neededBy_idx" ON "production_orders"("status", "neededBy");

-- CreateIndex
CREATE INDEX "production_orders_clientId_idx" ON "production_orders"("clientId");

-- CreateIndex
CREATE INDEX "production_order_lines_productionOrderId_idx" ON "production_order_lines"("productionOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_code_key" ON "purchase_requests"("code");

-- CreateIndex
CREATE INDEX "purchase_requests_status_neededBy_idx" ON "purchase_requests"("status", "neededBy");

-- CreateIndex
CREATE INDEX "purchase_request_lines_purchaseRequestId_idx" ON "purchase_request_lines"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "purchase_request_lines_materialId_idx" ON "purchase_request_lines"("materialId");

-- CreateIndex
CREATE INDEX "custom_fields_entity_active_order_idx" ON "custom_fields"("entity", "active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_entity_key_key" ON "custom_fields"("entity", "key");

-- CreateIndex
CREATE INDEX "attachments_lotId_idx" ON "attachments"("lotId");

-- CreateIndex
CREATE INDEX "attachments_receiptId_idx" ON "attachments"("receiptId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_substitutes" ADD CONSTRAINT "material_substitutes_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_substitutes" ADD CONSTRAINT "material_substitutes_substituteId_fkey" FOREIGN KEY ("substituteId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_materials" ADD CONSTRAINT "supplier_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_materials" ADD CONSTRAINT "supplier_materials_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_tags" ADD CONSTRAINT "material_tags_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_tags" ADD CONSTRAINT "material_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_parentLotId_fkey" FOREIGN KEY ("parentLotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "helpers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "inventory_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "inventory_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counts" ADD CONSTRAINT "counts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counts" ADD CONSTRAINT "counts_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_lines" ADD CONSTRAINT "count_lines_countId_fkey" FOREIGN KEY ("countId") REFERENCES "counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_lines" ADD CONSTRAINT "count_lines_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_lines" ADD CONSTRAINT "count_lines_foundLocationId_fkey" FOREIGN KEY ("foundLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_lines" ADD CONSTRAINT "count_lines_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_products" ADD CONSTRAINT "finished_products_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "finished_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "finished_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bills_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "finished_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bills_of_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_requirements" ADD CONSTRAINT "calculation_requirements_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_requirements" ADD CONSTRAINT "calculation_requirements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "finished_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bills_of_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "inventory_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

