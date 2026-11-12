-- Desglose de cada talla por PO del cliente: cuántas piezas de la talla son
-- de cada PO. Aditiva: la versión anterior de la app ignora la tabla.
CREATE TABLE "cutting_order_line_pos" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "clientPo" TEXT,
    "quantity" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cutting_order_line_pos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cutting_order_line_pos_lineId_idx" ON "cutting_order_line_pos"("lineId");
CREATE INDEX "cutting_order_line_pos_clientPo_idx" ON "cutting_order_line_pos"("clientPo");

ALTER TABLE "cutting_order_line_pos"
  ADD CONSTRAINT "cutting_order_line_pos_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "cutting_order_lines"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada talla que ya existe recibe un renglón con su cantidad completa y su
-- PO de hoy (o ninguno). Así el desglose cuadra con orderedQuantity desde el
-- primer día y el packing list no tiene que distinguir órdenes viejas.
-- Una talla de antes que traía "9122, 9542" queda en un solo renglón con ese
-- texto: no hay forma de saber cuánto era de cada uno sin preguntarle a nadie.
INSERT INTO "cutting_order_line_pos" ("id", "lineId", "clientPo", "quantity", "position")
SELECT 'po' || md5("id"), "id", "clientPo", "orderedQuantity", 0
FROM "cutting_order_lines";
