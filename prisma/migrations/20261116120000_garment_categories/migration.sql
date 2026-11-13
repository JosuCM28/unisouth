-- AlterTable
ALTER TABLE "finished_products" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "garment_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "garment_categories_name_key" ON "garment_categories"("name");

-- CreateIndex
CREATE INDEX "garment_categories_deletedAt_position_idx" ON "garment_categories"("deletedAt", "position");

-- CreateIndex
CREATE INDEX "finished_products_categoryId_idx" ON "finished_products"("categoryId");

-- AddForeignKey
ALTER TABLE "finished_products" ADD CONSTRAINT "finished_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "garment_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Datos ────────────────────────────────────────────────────────────────
-- Los tipos de prenda con los que arranca Embarques. El id imita un cuid
-- ("c" + 32 caracteres) porque las validaciones de la app lo exigen.
INSERT INTO "garment_categories" ("id", "name", "position", "updatedAt") VALUES
  ('c' || replace(gen_random_uuid()::text, '-', ''), 'CAMISA',   10, CURRENT_TIMESTAMP),
  ('c' || replace(gen_random_uuid()::text, '-', ''), 'PANTALÓN', 20, CURRENT_TIMESTAMP),
  ('c' || replace(gen_random_uuid()::text, '-', ''), 'CHAMARRA', 30, CURRENT_TIMESTAMP),
  ('c' || replace(gen_random_uuid()::text, '-', ''), 'OVEROL',   40, CURRENT_TIMESTAMP);

-- Lo que ya estaba escrito a mano en `category` se vuelve categoría, sin
-- duplicar las de arriba. En mayúsculas, como guarda la app todo texto.
INSERT INTO "garment_categories" ("id", "name", "position", "updatedAt")
SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), UPPER(src.name), 100, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (LOWER(TRIM("category"))) TRIM("category") AS name
  FROM "finished_products"
  WHERE "category" IS NOT NULL AND TRIM("category") <> ''
) src
WHERE NOT EXISTS (
  SELECT 1 FROM "garment_categories" gc WHERE LOWER(gc."name") = LOWER(src.name)
);

-- Y cada producto queda ligado a la suya.
UPDATE "finished_products" fp
SET "categoryId" = gc."id"
FROM "garment_categories" gc
WHERE fp."category" IS NOT NULL
  AND LOWER(gc."name") = LOWER(TRIM(fp."category"));
