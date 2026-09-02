-- Liga real entre un vale de salida y la orden (y el corte) del que salió.
--
-- Hasta ahora lo único que las unía era el texto de `reference`, que copia el
-- número de papel del cliente. Dos órdenes del mismo cliente pueden traer el
-- mismo número, así que cruzar por ahí terminaría colgándole a una orden la
-- salida de otra. Y sin liga, la ficha de la orden no puede contestar la
-- pregunta que se hace a diario: "¿esto ya salió, y sigue en pie?".
--
-- Las dos columnas son NULLABLE y no se rellenan: los vales viejos se quedan
-- sin liga a propósito. Adivinarla por texto sería inventar un dato en la
-- bitácora de lo que salió por la puerta.

-- AlterTable
ALTER TABLE "inventory_documents" ADD COLUMN "cuttingOrderId" TEXT;
ALTER TABLE "inventory_documents" ADD COLUMN "cuttingBatchId" TEXT;

-- CreateIndex
CREATE INDEX "inventory_documents_cuttingOrderId_idx" ON "inventory_documents"("cuttingOrderId");

-- CreateIndex
CREATE INDEX "inventory_documents_cuttingBatchId_idx" ON "inventory_documents"("cuttingBatchId");

-- AddForeignKey
-- SET NULL y no CASCADE: el vale es el acta de lo que salió por la puerta y
-- tiene que sobrevivir a que alguien borre la orden. Se queda huérfano, que es
-- honesto, en vez de desaparecer con ella.
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_cuttingOrderId_fkey" FOREIGN KEY ("cuttingOrderId") REFERENCES "cutting_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
