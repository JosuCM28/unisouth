-- PO del cliente por talla. Aditiva y opcional: las tallas existentes quedan
-- en NULL y la versión anterior de la app la ignora.
ALTER TABLE "cutting_order_lines" ADD COLUMN "clientPo" TEXT;
