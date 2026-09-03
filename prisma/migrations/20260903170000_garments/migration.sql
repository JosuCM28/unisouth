-- Prendas: el catálogo VISUAL con el que trabaja el taller.
--
-- Contesta una pregunta que ninguna otra tabla contestaba: "¿dónde va
-- exactamente el bordado en esta chamarra?". Hasta hoy se respondía prestando
-- una prenda de muestra o con una foto en el celular de alguien, y el día que
-- esa persona no estaba, el taller adivinaba.
--
-- A propósito NO cuelga de finished_products: ese modelo alimenta fichas
-- técnicas y cálculos de tela, y meterle fotos arrastraría megabytes a
-- consultas que sólo quieren números.

CREATE TABLE "garment_photos" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garment_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "garment_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garment_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "garments" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "photoId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "garment_placements" (
    "id" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "photoId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garment_placements_pkey" PRIMARY KEY ("id")
);

-- Una foto pertenece a UNA prenda o a UN marcado, nunca a dos: si se
-- compartiera, reemplazarla en un lado la cambiaría en el otro sin avisar.
CREATE UNIQUE INDEX "garments_photoId_key" ON "garments"("photoId");
CREATE UNIQUE INDEX "garment_placements_photoId_key" ON "garment_placements"("photoId");

CREATE INDEX "garment_folders_deletedAt_name_idx" ON "garment_folders"("deletedAt", "name");
CREATE INDEX "garment_folders_clientId_idx" ON "garment_folders"("clientId");
CREATE INDEX "garments_folderId_position_idx" ON "garments"("folderId", "position");
CREATE INDEX "garments_deletedAt_idx" ON "garments"("deletedAt");
CREATE INDEX "garment_placements_garmentId_position_idx" ON "garment_placements"("garmentId", "position");

ALTER TABLE "garment_photos" ADD CONSTRAINT "garment_photos_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "garment_folders" ADD CONSTRAINT "garment_folders_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "garment_folders" ADD CONSTRAINT "garment_folders_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cascade de la carpeta a sus prendas y de la prenda a sus marcados: son
-- partes de la misma ficha, no registros con vida propia.
ALTER TABLE "garments" ADD CONSTRAINT "garments_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "garment_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull y no Cascade: borrar la foto no puede llevarse la prenda entera.
ALTER TABLE "garments" ADD CONSTRAINT "garments_photoId_fkey"
  FOREIGN KEY ("photoId") REFERENCES "garment_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "garments" ADD CONSTRAINT "garments_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "garment_placements" ADD CONSTRAINT "garment_placements_garmentId_fkey"
  FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garment_placements" ADD CONSTRAINT "garment_placements_photoId_fkey"
  FOREIGN KEY ("photoId") REFERENCES "garment_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
