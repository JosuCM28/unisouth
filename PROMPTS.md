# Prompts por fase para Claude Code

## Cómo usar este archivo

1. Copia `CLAUDE.md` y `prisma/schema.prisma` a `D:\proyects\unisouth\`.
2. Abre la terminal ahí y corre `claude`.
3. Pega **un prompt a la vez**, en orden. No pegues dos juntos.
4. Al terminar cada fase: revisa, corre `npx tsc --noEmit`, haz commit.
5. Si el contexto se llena, usa `/compact` — `CLAUDE.md` se relee solo.

> Claude Code lee `CLAUDE.md` automáticamente en cada sesión. Por eso los
> prompts de abajo son cortos: las reglas ya están puestas.

---

## FASE 0 — Andamiaje

```
Lee CLAUDE.md completo antes de empezar.

Inicializa el proyecto Next.js 15 en esta carpeta (que ya tiene CLAUDE.md y
prisma/schema.prisma). Requisitos:

- App Router, TypeScript estricto, Tailwind v4, SIN carpeta src/, alias "@/*"
- Instala: prisma @prisma/client better-auth react-hook-form zod
  @hookform/resolvers lucide-react sonner clsx tailwind-merge
  class-variance-authority decimal.js
- Dev: tsx, @types/node, @types/react, @types/react-dom
- Inicializa shadcn/ui estilo "new-york", baseColor slate, cssVariables true,
  rsc true, css en app/globals.css, sin carpeta src
- Agrega estos componentes shadcn: button card input label textarea select
  dialog sheet badge table separator switch form sonner dropdown-menu tabs
  avatar tooltip skeleton alert
- Crea .env y .env.example con las 5 variables de la sección 16 de CLAUDE.md
  (déjame los valores en blanco, yo los lleno)
- .gitignore con .env
- next.config.ts: serverActions.bodySizeLimit 4mb, serverExternalPackages
  ["@prisma/client"]
- package.json scripts: db:generate, db:push, db:migrate, db:studio, db:seed
- Crea la estructura de carpetas vacía de la sección 3 de CLAUDE.md

Luego escribe app/globals.css completo con el tema FLAT DESIGN de la sección 9:
tokens en @theme inline, colores oklch, radio 4px, acento ámbar industrial,
más las clases .flat-surface, .tabular, .touch-target, .safe-top, .safe-bottom,
.no-scrollbar.

No escribas todavía ninguna otra cosa. Al terminar reporta y espera.
```

---

## FASE 1 — Base de datos y Prisma

```
El archivo prisma/schema.prisma ya está listo, NO lo modifiques salvo que
encuentres un error de sintaxis.

1. Corre `npx prisma format` y `npx prisma validate`. Si hay errores, arréglalos
   y dime cuáles fueron.
2. Corre `npx prisma generate` y luego `npx prisma db push` contra Neon.
3. Crea lib/prisma.ts: singleton de PrismaClient con el patrón globalThis para
   dev, más los tipos PrismaTransaction y PrismaExecutor exportados.
4. Crea lib/utils.ts con: cn(), toPlainObject() (convierte Decimal a number
   recursivamente para poder pasar datos a Client Components), formatQuantity(),
   formatCurrency(), formatDate(), formatDateTime() — todos con locale es-MX.
5. Crea prisma/seed.ts que inserte datos mínimos y sea idempotente (usa upsert):
   - Tallas: CH 0.92, M 1.00, G 1.08, XG 1.16, 2XG 1.24 (grupo "letra")
   - 4 ubicaciones tipo ROW: F1..F4, más una tipo REMNANTS "RETAZOS"
   - 1 cliente de ejemplo "Ternium"
   - 2 materiales: una mezclilla (type FABRIC, baseUnit METER, weightOz 12,
     requiresShade true, remnantThreshold 5) y un cierre (type ZIPPER,
     baseUnit PIECE)
   - Settings base y las Sequence iniciales

Reporta el resultado de db push antes de seguir.
```

---

## FASE 2 — Núcleo de infraestructura

```
Construye lib/core/ completo. Es la base de todo lo demás, hazlo bien:

1. errors.ts — clase abstracta DomainError con `code` abstracto y `field`
   opcional. Subclases: NotFoundError, ValidationError, DuplicateError,
   BusinessRuleError, InsufficientStockError, UnauthorizedError, ForbiddenError.
   Mensajes en español, listos para mostrar al usuario.

2. result.ts — tipo ActionResult<T> (unión discriminada success true/false),
   helpers ok(), fail(), y el type guard isOk(). Objetos planos, no clases:
   cruzan la frontera servidor→cliente.

3. base-repository.ts — clase abstracta BaseRepository<TEntity, TCreate, TUpdate>
   - `protected abstract get delegate(): PrismaDelegate`
   - `protected abstract get entityName(): string`
   - `protected readonly usesSoftDelete = true`
   - métodos: findById, findByCode, exists, create, update, delete (soft),
     y `protected paginate(where, orderBy, pagination, include)` que devuelve
     PaginatedResult<T> con items/total/page/pageSize/totalPages
   - `protected get notDeleted()` → { deletedAt: null }
   Documenta con comentarios QUÉ pilar de POO representa cada parte.

4. sequence.service.ts — SequenceService.next(seriesKey, prefix, padding).
   Usa upsert con increment atómico. Formato: PREFIX-AÑO-00001. Debe funcionar
   dentro de una transacción (recibe el executor por constructor).

5. audit.service.ts — AuditService con AuditContext (userId, userName, ip,
   userAgent, source) y método record(). Calcula changedFields[] comparando
   oldValue vs newValue campo por campo con JSON.stringify.

6. session.ts — getCurrentUser() envuelto en `cache` de React,
   requireUser(), requirePermission(permission), buildAuditContext(user)
   que lee IP y user-agent de headers().

7. action-handler.ts — executeAction(rawInput, config) donde config tiene
   { schema, permission, revalidate?, handler, successMessage? }.
   Hace: requirePermission → schema.parse → handler → revalidatePath →
   ok(toPlainObject(output)). En catch: ZodError → primer issue con su path;
   DomainError → su code y field; cualquier otra cosa → console.error completo
   y mensaje genérico al usuario (no filtrar internos).

8. lib/services/base.service.ts — BaseService abstracta con `db`, `audit`,
   `sequences` y `context` protected, inicializados en el constructor.

Corre `npx tsc --noEmit` al terminar.
```

---

## FASE 3 — Constantes, roles y auth

```
1. lib/constants/roles.ts
   - const ROLES as const con los 6 roles, tipo Role derivado, ROLE_VALUES,
     ROLE_LABELS en español
   - const PERMISSIONS as const: inventory:read, inventory:write,
     inventory:adjust, catalog:write, bom:write, calculation:run,
     purchase:request, purchase:approve, audit:read, user:manage
   - ROLE_PERMISSIONS según la tabla de la sección 8 de CLAUDE.md
   - roleHasPermission(role, permission)

2. lib/constants/labels.ts — diccionarios Record<Enum, string> en español para
   MaterialType, Unit (largo y corto: "m", "pza", "kg"), LocationType, LotStatus
   (+ LOT_STATUS_STYLES con clases Tailwind de fondo sólido, flat), 
   MeasurementSource, DocumentType, DocumentStatus, MovementType,
   MovementDirection. Más el helper toSelectOptions(labels).

3. lib/auth.ts — BetterAuth con prismaAdapter(postgresql), emailAndPassword
   habilitado sin verificación de correo, minPasswordLength 8,
   additionalFields para role/phone/active/pinHash (role e input:false),
   session 30 días con cookieCache 5 min, plugins [admin, nextCookies].
   nextCookies SIEMPRE al final.

4. lib/auth-client.ts — createAuthClient con adminClient plugin, "use client".

5. app/api/auth/[...all]/route.ts — toNextJsHandler.

6. middleware.ts — getSessionCookie de better-auth/cookies. Sin cookie y no es
   /login → redirect a /login con ?redirect=. Con cookie y es /login → a
   /dashboard. Matcher que excluya api/auth, _next, favicon, manifest.
   Comenta que esto es sólo redirección optimista: la autorización real es en
   el servidor.

7. lib/constants/navigation.ts — NAVIGATION: NavSection[] con secciones
   Operación / Catálogos / Documentos, cada item con href, label, icon
   (lucide), permission y showOnMobileBar. Los 4 de la barra móvil:
   /dashboard, /lots, /lots/scan, /calculations. Exporta MOBILE_BAR_ITEMS.

8. app/(auth)/login/page.tsx + components/auth/login-form.tsx — login con
   RHF + Zod, email y contraseña, estilo flat, botones touch-target, errores
   con sonner. Si login exitoso → router.push del ?redirect o /dashboard.

Verifica que compile y que /login se vea bien en 375px de ancho.
```

---

## FASE 4 — Layout, sidebar y tablero

```
1. app/layout.tsx — fuente Inter con variable --font-sans, metadata con
   template "%s · Unisouth", viewport con userScalable false y themeColor,
   Toaster de sonner position top-center richColors.

2. app/(dashboard)/layout.tsx — Server Component. getCurrentUser(), si no hay
   redirect a /login. Monta AppSidebar (desktop), MobileHeader (móvil),
   main con padding-bottom 24 en móvil para que la barra inferior no tape
   contenido, y MobileNav.

3. components/layout/
   - app-sidebar.tsx — SERVER component. Filtra NAVIGATION por permisos del
     usuario antes de renderizar. Ancho 60, hidden md:flex, borde derecho.
   - sidebar-link.tsx — el ÚNICO fragmento cliente del sidebar, sólo para
     usePathname y marcar el activo.
   - mobile-nav.tsx — barra inferior fija, grid-cols-4, md:hidden, safe-bottom.
   - mobile-header.tsx — header sticky sólo móvil con logo y cerrar sesión.
   - user-menu.tsx — iniciales, nombre, rol, botón de salir.
   - page-header.tsx — título + descripción + slot de acción, con borde inferior.

4. lib/services/dashboard.service.ts — DashboardService con:
   - getKpis(): las 8 cifras en Promise.all → lotesEnBodega, porMedir
     (verified false), retazos, sinMover90días, materialesBajoReorden,
     movimientosHoy, cálculosConFaltante, requisicionesAbiertas.
     Para materialesBajoReorden: groupBy de lotes y comparación en memoria
     (Prisma no compara columnas de tablas distintas en un where).
   - getStockByClient(): groupBy por clientId con nombre resuelto.
   - getRecentMovements(limit): últimos movimientos con lote, material, usuario.

5. components/dashboard/
   - kpi-card.tsx — flat: borde 1px, sin sombra. Props label, value, hint,
     icon, tone (neutral/positive/warning/critical), href opcional.
     Los tonos como Record<KpiTone, string>, NO ternarias.
   - kpi-grid.tsx — grid-cols-2 en móvil, lg:grid-cols-4. Función
     toneForCount(value, warningAt, criticalAt) para decidir el tono.
   - kpi-grid-skeleton.tsx
   - recent-movements.tsx — lista con icono según signo de la cantidad
     (función directionIcon, no ternarias anidadas), clase .tabular en números.
   - stock-by-client.tsx — barras horizontales planas.

6. components/shared/
   - empty-state.tsx
   - submit-button.tsx — con isSubmitting, spinner, touch-target
   - search-input.tsx — cliente, escribe el término en la URL con debounce
     de 350ms usando router.replace. inputMode="search".

7. app/(dashboard)/dashboard/page.tsx — Server Component con Suspense por
   bloque para que los KPIs pinten antes que las tablas.

Al terminar quiero poder correr `npm run dev`, entrar a /dashboard y verlo
funcionando en escritorio y en 375px.
```

---

## FASE 5 — Repositorios y validaciones

```
1. lib/repositories/location.repository.ts — extiende BaseRepository.
   search(filters) con búsqueda en code y name, filtro por type y active.
   findAllWithLotCount() para el mapa de bodega (cuenta sólo lotes con
   existencia). countLots(locationId).

2. lib/repositories/material.repository.ts — search(filters) buscando en code,
   name, colorName y composition. findOptions(type?) que devuelve sólo los
   campos que necesitan los Select. getStockByMaterial(ids) resuelto con
   groupBy, NO trayendo todos los lotes a memoria.

3. lib/repositories/lot.repository.ts — usesSoftDelete = false (los lotes no se
   borran, cambian de estado).
   - search(filters) con búsqueda global en code, supplierLotNumber, shade,
     colorText, comment, material.name y receipt.guideNumber
   - findDetail(code) con material, ubicación, cliente, producción, recepción,
     últimos 50 movimientos y reservas activas
   - findAvailableForIssue({materialId, clientId, includeRemnants}) ordenado
     [{isRemnant: desc}, {receivedAt: asc}] — retazos primero, luego FIFO
   - countPhysicallyPresent(), countUnverified(), countByStatus(),
     countAgedBeyond(days)

4. lib/validations/common.ts — piezas reutilizables: cuidSchema, optionalCuid,
   optionalText (convierte "" a undefined), requiredText(label, max),
   numericString, positiveQuantity, nonNegativeQuantity, optionalNumber,
   percentage, paginationSchema.

5. lib/validations/location.schema.ts — code (mayúsculas, sin espacios, regex
   [A-Za-z0-9._-]) y name obligatorios; type, order, lotCapacity, parentId,
   notes, active opcionales.

6. lib/validations/material.schema.ts — code, name, type, baseUnit obligatorios.
   Resto opcional, incluidos thicknessMm Y weightOz (ambos conviven).
   Un .refine(): si purchaseUnit difiere de baseUnit, purchaseFactor es
   obligatorio y > 0.

7. lib/validations/lot.schema.ts — createLotSchema con SÓLO materialId,
   quantity y unit obligatorios. Además: cutLotSchema, recountLotSchema,
   transferLotSchema, updateLotSchema.

8. lib/validations/calculation.schema.ts — calculationLineSchema (productId,
   bomId, quantity entero positivo, sizeId/variantId opcionales) y
   calculationFormSchema con lines.min(1).

tsc --noEmit al terminar.
```

---

## FASE 6 — InventoryService (lo más delicado)

```
Esta es la fase crítica. Relee la sección 6 de CLAUDE.md antes de escribir.

lib/services/inventory.service.ts:

1. Patrón STRATEGY: clase abstracta MovementStrategy con `direction` abstracta,
   `signedQuantity(qty)` abstracto y `validate(lot, qty)` con las validaciones
   comunes (cantidad > 0, lote no bloqueado).
   Subclases:
   - InboundStrategy: direction IN, signo positivo
   - OutboundStrategy: direction OUT, signo negativo, y override de validate que
     verifica currentQuantity y también disponible (current - reserved),
     lanzando InsufficientStockError o BusinessRuleError según el caso
   - NeutralStrategy: direction NEUTRAL, signo 0 (traspasos, reclasificaciones)
   Mapa MOVEMENT_STRATEGIES: Record<MovementType, MovementStrategy> con los 14
   tipos. Comenta que agregar un tipo nuevo = agregar una entrada aquí.

2. applyMovement(request) → abre transacción y delega.
   applyMovementWithin(tx, request) → para usar dentro de una transacción ya
   abierta (documento con 20 renglones).

3. Dentro de applyMovementWithin, EN ESTE ORDEN:
   a. lockLot(tx, lotId): `await tx.$queryRaw\`SELECT id FROM lots WHERE id =
      ${lotId} FOR UPDATE\`` y luego findUnique. Comenta por qué.
   b. strategy.validate(lot, quantity)
   c. balanceBefore = Number(lot.currentQuantity)
   d. delta = strategy.signedQuantity(quantity); balanceAfter = round4(before + delta)
   e. folio con SequenceService(tx).next("MOV", "MOV", 7)
   f. crear Movement con balanceBefore, balanceAfter, unit del lote, usuario
      del contexto
   g. resolveStatus(tx, lot, balanceAfter): con ifs explícitos, NO ternarias.
      balanceAfter <= 0 → DEPLETED. Si hay Material.remnantThreshold y
      balanceAfter <= threshold → REMNANT + isRemnant true. Si estaba DEPLETED
      y ahora tiene saldo → AVAILABLE. En otro caso conserva su estado.
   h. update del lote con currentQuantity, status, isRemnant y locationId
      (si venía toLocationId)

4. Helper round4() a 4 decimales, igual al Decimal(14,4) de la base.

Escribe también scripts/verify-integrity.ts: recorre todos los lotes y compara
currentQuantity contra la suma de sus movimientos, imprimiendo los que no
cuadren. Agrega el script a package.json.

No sigas a la fase 7 hasta que me confirmes que esto compila.
```

---

## FASE 7 — Servicios de dominio y actions

```
1. lib/services/location.service.ts — create, update, remove.
   remove() rechaza con BusinessRuleError si la ubicación todavía tiene lotes
   con existencia ("traspásalos primero"). Todo registra en AuditService con la
   sensibilidad correcta (CREATE low, UPDATE medium, DELETE high).

2. lib/services/lot.service.ts:
   - create(): dentro de una transacción, genera folio con SequenceService,
     crea el lote con currentQuantity 0, y aplica RECEIPT_INITIAL vía
     InventoryService. Comenta por qué no se escribe el saldo a mano.
   - update(): sólo campos descriptivos, NUNCA cantidades.
   - cut(): aplica ISSUE_PRODUCTION, audita sensitivity MEDIUM.
   - recount(): calcula la diferencia; si es 0 sólo marca verified; si no,
     aplica RECEIPT_ADJUSTMENT o ISSUE_ADJUSTMENT según el signo, marca
     verified y audita con sensitivity HIGH y motivo obligatorio.
   - transfer(): RECLASSIFICATION con cantidad 0, from → to.

3. app/actions/ — location.actions.ts, material.actions.ts, lot.actions.ts.
   Todas usan executeAction. Cada una declara: schema, permission, revalidate
   y delega al servicio. Ni una línea de lógica ni una llamada a Prisma directa.
   Ojo: recountLotAction usa INVENTORY_ADJUST, no INVENTORY_WRITE.

tsc --noEmit.
```

---

## FASE 8 — CRUD de Ubicaciones (vertical de referencia)

```
Construye el módulo de Ubicaciones completo. Va a ser la PLANTILLA que copiemos
para los demás CRUDs, así que hazlo impecable.

1. app/(dashboard)/locations/page.tsx — Server Component. Lee searchParams,
   consulta el repositorio, monta PageHeader + SearchInput + LocationList.
   Máximo 80 líneas.

2. components/locations/location-list.tsx — SERVER component.
   En móvil: tarjetas apiladas. Desde md: tabla.
   Cada fila muestra código, nombre, tipo (traducido con el diccionario),
   número de lotes, y el menú de acciones.

3. components/locations/location-form-dialog.tsx — cliente.
   RHF + zodResolver con locationFormSchema. Dialog en escritorio, Sheet
   inferior en móvil. Sirve para crear Y editar (recibe `location?`).
   Campos: code y name arriba (obligatorios); type, order, capacidad, padre y
   notas en una sección "Opcional" colapsable.
   Al enviar: llama la action, si !success muestra toast.error con el mensaje
   y si viene `field` hace form.setError en ese campo; si success cierra y
   toast.success.

4. components/locations/location-actions.tsx — dropdown Editar / Eliminar,
   con AlertDialog de confirmación en eliminar.

5. components/locations/warehouse-map.tsx — el mapa visual de la bodega:
   las filas como columnas, cada una con su conteo de lotes. Flat, sin sombras.
   Móvil: scroll horizontal con .no-scrollbar.

Cuando termines, muéstrame cómo se ve en 375px antes de seguir.
```

---

## FASE 9 — CRUD de Materiales y Clientes

```
Replica exactamente el patrón de la fase 8 para:

1. Materiales (app/(dashboard)/materials/ + components/materials/)
   - El formulario agrupa en secciones: "Identificación" (código, nombre, tipo,
     unidad base — los obligatorios), "Características de tela" (composición,
     color, ancho, GROSOR EN MM, PESO EN OZ, gramaje, encogimiento) que sólo se
     muestra si type === FABRIC, "Control de inventario" (mínimo, punto de
     reorden, umbral de retazo, requiere tono) y "Compra" (unidad y factor).
   - La lista muestra la existencia agregada por material usando
     getStockByMaterial, con indicador visual cuando está bajo el punto de
     reorden.
   - Muestra "12 oz" o "0.45 mm" según cuál campo esté lleno — con una función
     helper, no ternarias en el JSX.

2. Clientes (CRUD simple: sólo `name` obligatorio).

3. Producciones (ProductionRun): code, name y cliente obligatorios.

Reutiliza componentes de components/shared/ en vez de duplicar. Si notas que
estás copiando el mismo bloque por tercera vez, extráelo a shared/ y dime.
```

---

## FASE 10 — Inventario: la pantalla principal (móvil primero)

```
Esta es LA pantalla. Diséñala pensando en alguien de pie, con una mano,
sosteniendo un rollo con la otra.

1. app/(dashboard)/lots/page.tsx — lista con filtros en la URL: search,
   materialId, locationId, clientId, status, onlyRemnants, onlyUnverified.
   Server Component.

2. components/lots/lot-filters.tsx — chips horizontales scrolleables en móvil
   (.no-scrollbar), Select normales desde md:.

3. components/lots/lot-card.tsx — tarjeta móvil de un rollo. Muestra en este
   orden de prominencia: folio (grande, .tabular), material y color,
   CANTIDAD ACTUAL grande a la derecha con su unidad corta, y abajo en chips
   pequeños: ubicación, tono, cliente, badge de estado con
   LOT_STATUS_STYLES. Toda la tarjeta es un Link a /lots/[code].

4. components/lots/lot-table.tsx — versión de escritorio, hidden hasta md:.

5. app/(dashboard)/lots/[code]/page.tsx — ficha del rollo. Usa findDetail().
   Arriba: folio, material, cantidad grande. Luego datos de recepción (guía,
   paquetería, origen, fecha, proveedor). Luego el kárdex: lista de movimientos
   con tipo traducido, cantidad con signo, usuario y fecha.
   Debajo, botones de acción GRANDES (touch-target): Cortar · Recontar ·
   Traspasar.

6. components/lots/lot-form-sheet.tsx — alta de lote. Sheet desde abajo en
   móvil. SÓLO material, cantidad y unidad visibles de entrada; el resto
   (ubicación, cliente, producción, tono, lote proveedor, medidas, comentario)
   en secciones colapsables. La unidad se autoselecciona con el baseUnit del
   material elegido.

7. components/lots/cut-lot-dialog.tsx — la operación de todos los días.
   Un solo input numérico GRANDE (text-3xl, inputMode="decimal", autoFocus),
   muestra el saldo disponible arriba y el remanente calculado en vivo abajo.
   Botones de atajo: "Todo" y "Mitad". Un botón grande de confirmar.
   Debe lograrse en 2 toques desde la ficha.

8. components/lots/recount-dialog.tsx — input de cantidad medida, muestra la
   diferencia contra el sistema en vivo con color (verde/rojo), y campo de
   motivo OBLIGATORIO. Advierte que quedará registrado en la bitácora.

9. components/lots/transfer-dialog.tsx — select de ubicación destino + motivo.

10. app/(dashboard)/lots/scan/page.tsx + components/lots/qr-scanner.tsx —
    escáner con la API nativa BarcodeDetector y fallback a input manual de
    folio. Al detectar, router.push a /lots/[code].
    Instala html5-qrcode SÓLO si BarcodeDetector no basta, y pregúntame antes.

11. app/r/[code]/route.ts — redirect corto de QR a /lots/[code].

Pruébalo mentalmente en 375px: ¿puedo dar de alta un rollo en menos de 20
segundos? ¿puedo cortar en 2 toques? Si no, ajústalo.
```

---

## FASE 11 — Fichas técnicas y motor de cálculo

```
1. CRUD de FinishedProduct + Variant + Size (catálogo de tallas con su
   consumptionFactor editable).

2. CRUD de BillOfMaterials con sus BomLine:
   - Editor de ficha: agregar renglones material + consumoPorUnidad + unidad +
     merma% + parte + talla opcional
   - Versionado: si la ficha está ACTIVE y ya fue usada por un cálculo, editar
     crea v2 en vez de modificar. Explícalo en la interfaz.
   - Simulador integrado: "si produzco N piezas, necesito esto" en vivo, sin
     guardar nada.

3. lib/services/calculation.service.ts — el motor. Relee la sección 15 de
   CLAUDE.md. Estructura:
   - explodeLines(tx, input): recorre las líneas, salta las BomLine cuyo sizeId
     no corresponde, resuelve el factor de talla (variante > talla > 1),
     acumula en un Map<materialId, {baseQuantity, weightedWaste}>.
     La merma se acumula PONDERADA por cantidad, no promediada a secas.
   - computeLineConsumption() en método aparte: es LA fórmula, debe poder
     probarse aislada. Maneja isFixedQuantity y hasOwnSize.
   - combineWaste(línea, global) = ((1+l/100)*(1+g/100)-1)*100. Comenta que
     las mermas se componen, no se suman.
   - resolveAvailability(): por cada material busca lotes candidatos
     (retazos primero, luego FIFO), calcula totalStock/reserved/available/
     remnant, shortage = max(0, required - available), y arma suggestedLots[]
     tomando de cada lote hasta cubrir lo requerido.
   - buildWarnings(): si el material requiresShade y se mezclarían >1 tonos,
     advertencia. Si hay faltante, advertencia.
   - Todo se guarda como SNAPSHOT en Calculation + CalculationRequirement.

4. app/actions/calculation.actions.ts — runCalculationAction con permiso
   CALCULATION_RUN.

5. UI del cálculo (components/calculations/):
   - calculator-form.tsx — useFieldArray de RHF para las líneas. Selects de
     producto → ficha activa → talla, más input de cantidad. Opciones:
     respetar dueño, incluir retazos, factor de seguridad.
   - requirement-table.tsx — el resultado. Una fila por material con:
     requerido, disponible, faltante, y semáforo verde/rojo. Expandible para
     ver los lotes sugeridos con su folio, tono y UBICACIÓN FÍSICA en orden
     de recorrido.
   - Botón "Generar requisición" con los faltantes.

Caso de prueba obligatorio: Overol para gasera = 2 m de tela + 4 cierres por
pieza. Pido 500 → debe dar 1,000 m (más merma) y 2,000 cierres.
```

---

## FASE 12 — Documentos, requisiciones y auditoría

```
1. Documentos de entrada y salida (InventoryDocument + DocumentLine):
   - Alta en DRAFT con renglones editables
   - Botón "Aplicar" que dentro de UNA transacción recorre los renglones y
     llama a InventoryService.applyMovementWithin() por cada uno
   - Cancelar genera movimientos inversos, no borra
   - Vista imprimible del vale (para firma física)

2. Recepciones: wizard de 2 pasos. Paso 1 encabezado (fecha, guía, paquetería,
   origen, proveedor, cliente, factura). Paso 2 tabla tipo hoja de cálculo para
   capturar N lotes de golpe, con navegación por Tab/Enter y botón para
   duplicar el renglón anterior. Al guardar, todos los lotes cuelgan de esa
   recepción.

3. Requisiciones de compra: CRUD + flujo de estados
   DRAFT → SUBMITTED → APPROVED/REJECTED → ORDERED → RECEIVED.
   Sólo el rol PURCHASING o ADMIN puede aprobar. Vista imprimible.

4. app/(dashboard)/audit/page.tsx — tablero de "quién metió mano".
   Filtros por usuario, entidad, acción, sensibilidad y rango de fechas.
   Los registros HIGH y CRITICAL destacados. Detalle expandible que muestra
   campo por campo el antes y el después. Sólo rol con permiso audit:read.

5. Exportación a Excel de las listas principales (SheetJS). Los patrones
   siempre piden Excel.
```

---

## FASE 13 — Cierre

```
1. Corre `npx tsc --noEmit`, `npm run build` y `npm run lint`. Arregla todo.
2. Corre scripts/verify-integrity.ts y confirma que todos los saldos cuadran
   con el kárdex.
3. Revisa que ninguna escritura a Lot.currentQuantity ocurra fuera de
   InventoryService — búscalo con grep y repórtame los resultados.
4. Revisa que ninguna Server Action llame a Prisma directamente.
5. Busca ternarias anidadas en todo el proyecto y refactorízalas.
6. Genera un README.md con: qué es el proyecto, cómo instalar, variables de
   entorno, comandos disponibles, y un diagrama de las capas.
7. Dame una lista de lo que quedó pendiente o a medias.
```

---

## Prompts sueltos útiles

**Cuando algo se rompa:**
```
Corre npx tsc --noEmit y arregla SÓLO los errores de tipos. No refactorices
nada más, no agregues features, no "mejores" código que ya funciona.
```

**Cuando quieras revisar calidad:**
```
Revisa [archivo] contra las reglas de CLAUDE.md secciones 4, 5 y 6.
Dime qué incumple y por qué, sin arreglarlo todavía.
```

**Cuando el diseño se desvíe:**
```
Revisa todos los componentes de components/ y quita cualquier shadow-*,
gradient, backdrop-blur o rounded mayor a 4px. El sistema es flat, sección 9
de CLAUDE.md.
```

**Cuando quieras una vista móvil mejor:**
```
Revisa [componente] en 375px de ancho. ¿Se puede operar con el pulgar de una
mano? ¿Los botones son de 44px mínimo? ¿Hay scroll horizontal indeseado?
Ajusta lo que haga falta.
```
