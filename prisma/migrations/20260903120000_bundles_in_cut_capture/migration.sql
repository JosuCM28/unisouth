-- Bultos en la captura de corte y en el envío a taller.
--
-- La tabla de corte del vale (document_cut_lines) ya llevaba `bundles` desde
-- el principio: es la hoja de papel que el taller firma. Lo que faltaba era
-- capturarlo en el origen, así que las dos bitácoras que alimentan ese vale
-- lo reciben con la MISMA lectura —la cantidad es POR BULTO— y el desglose
-- viaja hasta la salida sin que nadie lo vuelva a teclear.
--
-- DEFAULT 1 y NOT NULL: los renglones que ya existen se capturaron como un
-- bulto por talla, así que 1 los deja valiendo exactamente lo que valían y
-- `cutting_order_lines."cutQuantity"` sigue cuadrando sin recalcular nada.

ALTER TABLE "cutting_progress"
  ADD COLUMN "bundles" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "garment_shipment_lines"
  ADD COLUMN "bundles" INTEGER NOT NULL DEFAULT 1;
