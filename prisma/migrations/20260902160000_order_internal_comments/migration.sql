-- Comentarios INTERNOS de una orden de corte.
--
-- No se reusa `cutting_orders.notes` porque ese campo es parte del DOCUMENTO:
-- se imprime en la hoja que firma el taller y se copia al vale de salida.
-- Éstos son las notas de planeación de la oficina —"30% a Shawcor, el resto
-- se queda aquí"— y no pueden salir del edificio.
--
-- Van como lista y no como un solo texto editable para que cada decisión
-- conserve su fecha: meses después la pregunta no es sólo qué se decidió sino
-- cuándo, y sobrescribir un campo único borra justo eso.

-- CreateTable
CREATE TABLE "cutting_order_comments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cutting_order_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Por orden y fecha: así se leen, del más nuevo al más viejo.
CREATE INDEX "cutting_order_comments_orderId_createdAt_idx" ON "cutting_order_comments"("orderId", "createdAt");

-- AddForeignKey
-- CASCADE: un comentario sobre una orden que ya no existe no le sirve a nadie,
-- y la orden sólo se borra con motivo obligatorio.
ALTER TABLE "cutting_order_comments" ADD CONSTRAINT "cutting_order_comments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "cutting_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL: dar de baja a una persona no borra lo que anotó.
ALTER TABLE "cutting_order_comments" ADD CONSTRAINT "cutting_order_comments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
