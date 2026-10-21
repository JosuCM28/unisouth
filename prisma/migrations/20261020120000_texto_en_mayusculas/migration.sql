-- Todo el texto capturado pasa a MAYÚSCULAS.
--
-- Por qué: "Blanco" y "BLANCO" son el mismo tono para el auxiliar, pero no
-- para un GROUP BY ni para la advertencia de tonos mezclados al surtir. Había
-- 16 tonos partidos en dos pilas. Desde esta versión el servidor guarda todo
-- en mayúsculas (lib/validations/common.ts); esto empareja lo que ya estaba.
--
-- Qué NO se toca, y por qué:
--   · movements y audit_logs: son append-only. Lo que dicen es lo que se
--     escribió en su momento, y reescribirlo rompe la regla sagrada.
--   · Tablas de BetterAuth (account, session, verification), user.email y
--     user.role: el rol es una llave que el código compara tal cual.
--   · Correos, URLs, colores hex y llaves de archivos: ahí la caja importa.
--   · settings, sequences, custom_fields: son llaves internas.
--   · calculation_requirements.warnings: es un SNAPSHOT del cálculo.
--   · Folios generados (R-, REC-, OUT-…): ya nacen en mayúsculas.
--
-- Este cambio masivo no deja un renglón de AuditLog por registro: serían
-- miles de cambios de forma, no de fondo, y taparían los que sí importan.

-- Pone en mayúsculas una columna de texto.
CREATE FUNCTION pg_temp.upper_col(tbl text, col text) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = upper(%I) WHERE %I IS DISTINCT FROM upper(%I)',
    tbl, col, col, col, col
  );
END;
$$ LANGUAGE plpgsql;

-- Lo mismo para una columna text[], respetando el orden de los renglones
-- (las notas del corte salen numeradas en la hoja).
CREATE FUNCTION pg_temp.upper_array(tbl text, col text) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = ARRAY(SELECT upper(x) FROM unnest(%I) WITH ORDINALITY AS u(x, i) ORDER BY i)
     WHERE %I IS NOT NULL AND cardinality(%I) > 0',
    tbl, col, col, col, col
  );
END;
$$ LANGUAGE plpgsql;

-- Columna con índice único: si dos valores sólo difieren en la caja, el
-- UPPER chocaría y el contenedor no arrancaría. Al más reciente se le pega
-- " (DUPLICADO n)" para que quede a la vista y alguien lo resuelva a mano.
CREATE FUNCTION pg_temp.upper_unique(tbl text, col text) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I t SET %I = t.%I || '' (DUPLICADO '' || s.rn || '')''
     FROM (
       SELECT id, row_number() OVER (PARTITION BY upper(%I) ORDER BY id) - 1 AS rn
       FROM %I WHERE %I IS NOT NULL
     ) s
     WHERE s.id = t.id AND s.rn > 0',
    tbl, col, col, col, tbl, col
  );
  PERFORM pg_temp.upper_col(tbl, col);
END;
$$ LANGUAGE plpgsql;

-- ─── Clientes: fusionar los que sólo difieren en la caja ────────────────────
-- "Simitla" y "SIMITLA" eran el mismo dueño dado de alta dos veces. Sobrevive
-- el más antiguo (el que ya tiene órdenes y documentos) y todo lo que apunte
-- al duplicado se le pasa a él. El duplicado no se borra —los catálogos usan
-- baja lógica—, se renombra para liberar el nombre único y se da de baja.
CREATE TEMP TABLE client_merge AS
SELECT d.id AS dup_id, k.id AS keep_id
FROM clients d
JOIN LATERAL (
  SELECT c.id FROM clients c
  WHERE upper(c.name) = upper(d.name)
  ORDER BY c."createdAt", c.id
  LIMIT 1
) k ON k.id <> d.id;

UPDATE production_runs   x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE receipts          x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE lots              x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE finished_products x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE calculations      x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE production_orders x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE order_folders     x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE garment_folders   x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE standing_rules    x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE cutting_orders    x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;
UPDATE inventory_documents x SET "clientId" = m.keep_id FROM client_merge m WHERE x."clientId" = m.dup_id;

UPDATE clients c
SET name = c.name || ' (FUSIONADO ' || c.id || ')',
    code = NULL,
    active = false,
    "deletedAt" = COALESCE(c."deletedAt", CURRENT_TIMESTAMP)
FROM client_merge m
WHERE c.id = m.dup_id;

DROP TABLE client_merge;

-- ─── Columnas con índice único ──────────────────────────────────────────────
SELECT pg_temp.upper_unique('clients', 'name');
SELECT pg_temp.upper_unique('clients', 'code');
SELECT pg_temp.upper_unique('suppliers', 'name');
SELECT pg_temp.upper_unique('suppliers', 'code');
SELECT pg_temp.upper_unique('carriers', 'name');
SELECT pg_temp.upper_unique('helpers', 'name');
SELECT pg_temp.upper_unique('helpers', 'code');
SELECT pg_temp.upper_unique('tags', 'name');
SELECT pg_temp.upper_unique('workshops', 'name');
SELECT pg_temp.upper_unique('workshops', 'code');
SELECT pg_temp.upper_unique('process_stages', 'name');
SELECT pg_temp.upper_unique('process_stages', 'code');
SELECT pg_temp.upper_unique('warehouses', 'code');
SELECT pg_temp.upper_unique('materials', 'code');
SELECT pg_temp.upper_unique('finished_products', 'code');
SELECT pg_temp.upper_unique('sizes', 'code');
SELECT pg_temp.upper_unique('variants', 'sku');
SELECT pg_temp.upper_unique('cut_tag_options', 'code');
SELECT pg_temp.upper_unique('production_runs', 'code');

-- ─── Texto libre ────────────────────────────────────────────────────────────
SELECT pg_temp.upper_col(t, c) FROM (VALUES
  ('bills_of_materials', 'name'), ('bills_of_materials', 'notes'),
  ('bom_lines', 'notes'), ('bom_lines', 'part'),
  ('calculation_lines', 'notes'),
  ('calculations', 'name'), ('calculations', 'notes'),
  ('carriers', 'phone'),
  ('clients', 'legalName'), ('clients', 'taxId'), ('clients', 'contact'),
  ('clients', 'phone'), ('clients', 'notes'),
  ('count_lines', 'notes'),
  ('counts', 'name'), ('counts', 'notes'),
  ('cut_edit_requests', 'reason'), ('cut_edit_requests', 'reviewNote'),
  ('cut_tag_options', 'name'),
  ('cutting_batches', 'label'), ('cutting_batches', 'notes'),
  ('cutting_order_comments', 'body'),
  ('cutting_order_lines', 'notes'),
  ('cutting_orders', 'clientPo'), ('cutting_orders', 'cutFabricText'),
  ('cutting_orders', 'cutPattern'), ('cutting_orders', 'cutVersionNotes'),
  ('cutting_orders', 'deliveryPlace'), ('cutting_orders', 'description'),
  ('cutting_orders', 'notes'), ('cutting_orders', 'reference'),
  ('cutting_progress', 'notes'),
  ('document_cut_lines', 'notes'),
  ('document_lines', 'notes'),
  ('email_contacts', 'name'),
  ('finished_products', 'category'), ('finished_products', 'description'),
  ('finished_products', 'name'),
  ('garment_folders', 'name'), ('garment_folders', 'notes'),
  ('garment_placements', 'name'), ('garment_placements', 'notes'),
  ('garment_returns', 'notes'),
  ('garment_shipment_lines', 'notes'),
  ('garment_shipments', 'cancellationReason'), ('garment_shipments', 'notes'),
  ('garment_shipments', 'parts'), ('garment_shipments', 'reference'),
  ('garments', 'name'), ('garments', 'notes'), ('garments', 'reference'),
  ('global_cut_bundles', 'sizeCode'),
  ('goals', 'title'), ('goals', 'detail'),
  ('helpers', 'phone'), ('helpers', 'notes'),
  ('inventory_documents', 'cancellationReason'), ('inventory_documents', 'concept'),
  ('inventory_documents', 'cutDescription'), ('inventory_documents', 'cutFabricText'),
  ('inventory_documents', 'cutPattern'), ('inventory_documents', 'cutVersionNotes'),
  ('inventory_documents', 'handedOverBy'), ('inventory_documents', 'receivedBy'),
  ('inventory_documents', 'notes'), ('inventory_documents', 'reference'),
  ('locations', 'code'), ('locations', 'name'), ('locations', 'notes'),
  ('lots', 'shade'), ('lots', 'colorText'), ('lots', 'supplierLotNumber'),
  ('lots', 'comment'), ('lots', 'productionNote'), ('lots', 'blockReason'),
  ('material_substitutes', 'notes'),
  ('materials', 'name'), ('materials', 'subtype'), ('materials', 'description'),
  ('materials', 'composition'), ('materials', 'colorName'), ('materials', 'finish'),
  ('order_folders', 'name'), ('order_folders', 'notes'), ('order_folders', 'reference'),
  ('production_order_lines', 'notes'),
  ('production_orders', 'notes'), ('production_orders', 'requestedBy'),
  ('production_runs', 'name'), ('production_runs', 'notes'), ('production_runs', 'season'),
  ('purchase_request_lines', 'notes'), ('purchase_request_lines', 'specification'),
  ('purchase_requests', 'justification'), ('purchase_requests', 'notes'),
  ('purchase_requests', 'rejectionReason'),
  ('receipts', 'guideNumber'), ('receipts', 'origin'), ('receipts', 'invoiceRef'),
  ('receipts', 'orderRef'), ('receipts', 'notes'),
  ('reservations', 'notes'),
  ('sizes', 'name'), ('sizes', 'group'),
  ('standing_rules', 'title'), ('standing_rules', 'detail'),
  ('supplier_materials', 'supplierCode'),
  ('suppliers', 'taxId'), ('suppliers', 'contact'), ('suppliers', 'phone'),
  ('suppliers', 'address'), ('suppliers', 'notes'),
  ('tasks', 'title'), ('tasks', 'detail'), ('tasks', 'tag'),
  ('user', 'name'),
  ('variants', 'color'),
  ('warehouses', 'name'), ('warehouses', 'address'), ('warehouses', 'notes'),
  ('whatsapp_contacts', 'name'),
  ('workshops', 'contact'), ('workshops', 'phone'), ('workshops', 'address'),
  ('workshops', 'notes')
) AS v(t, c);

SELECT pg_temp.upper_array('cutting_orders', 'cutNotes');
SELECT pg_temp.upper_array('inventory_documents', 'cutNotes');
