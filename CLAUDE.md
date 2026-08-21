# UNISOUTH — Sistema de almacén textil

Este archivo es el contrato del proyecto. Léelo completo antes de escribir código
y respétalo en cada cambio. Si algo aquí choca con una instrucción puntual mía,
avísame en vez de asumir.

---

## 1. Contexto del negocio

Fábrica de ropa industrial (uniformes, overoles, pantalones) en Veracruz, México.
El usuario principal es el **auxiliar de almacén**: recibe insumos, los acomoda,
los entrega a producción y avisa cuándo hay que comprar.

Tres hechos que definen todo el diseño:

1. **La tela NO es de la fábrica.** Es del cliente que manda a maquilar
   (ej. Ternium). Varios clientes comparten la misma bodega. Todo el stock se
   segrega por dueño y jamás se surte material de un cliente a la producción de otro.
2. **Se trackea rollo por rollo**, no por artículo. Un rollo es una pieza física
   identificable con folio propio, metraje vivo, tono de tintura y ubicación.
   Mezclar dos tonos en un mismo tendido = prenda rechazada.
3. **La operación diaria es en celular**, de pie, con una mano, a veces con
   guantes y con WiFi intermitente. El escritorio es para reportes y catálogos.

---

## 2. Stack y versiones

| Pieza | Elección |
|---|---|
| Framework | Next.js 16 · App Router · React 19 |
| Lenguaje | TypeScript estricto |
| Base de datos | PostgreSQL 18 en Neon |
| ORM | Prisma 6 |
| Auth | BetterAuth (con plugin `admin`) |
| UI | shadcn/ui (estilo `new-york`) + Tailwind CSS v4 |
| Formularios | React Hook Form + Zod vía `@hookform/resolvers` |
| Notificaciones | `sonner` |
| Iconos | `lucide-react` |
| Deploy | Dokploy sobre VPS Hostinger |

**No instales** librerías de estado global, ni ORM alterno, ni component library
adicional. Si crees que hace falta algo, pregúntame antes.

---

## 3. Estructura de carpetas

**NO uses `src/`.** Todo cuelga de la raíz.

```
app/
  actions/                 Server Actions, una por dominio
  api/auth/[...all]/       Handler de BetterAuth
  (auth)/login/            Rutas públicas
  (dashboard)/             Rutas privadas — layout con sidebar
    dashboard/
    lots/                  Inventario (la pantalla principal)
    materials/
    locations/
    clients/
    calculations/
    documents/
    purchase-requests/
  globals.css
  layout.tsx
components/
  ui/                      shadcn (generado por CLI, NO editar a mano)
  layout/                  sidebar, barra móvil, headers
  dashboard/               KPIs y bloques del tablero
  shared/                  reutilizables entre módulos
  lots/  materials/  locations/  calculations/   ← uno por dominio
lib/
  core/                    infraestructura transversal
  repositories/            acceso a datos
  services/                reglas de negocio
  validations/             esquemas Zod
  constants/               enums, labels, navegación, roles
  prisma.ts  auth.ts  auth-client.ts  utils.ts
prisma/
  schema.prisma  seed.ts
proxy.ts                   (antes middleware.ts; Next 16 lo renombró)
```

**Regla de oro:** en `app/` sólo van Server Components delgados que resuelven
datos y montan componentes. La UI vive en `components/`. Si un archivo de `app/`
pasa de ~80 líneas, algo se debe mover a `components/`.

---

## 4. Arquitectura en capas

El flujo es siempre en una sola dirección:

```
Página (Server Component)
  └─> Repositorio            (lectura directa, sin lógica)

Componente cliente (formulario)
  └─> Server Action
        └─> executeAction()   permisos + Zod + errores + revalidate
              └─> Servicio    REGLAS DE NEGOCIO
                    └─> Repositorio
                          └─> Prisma
```

### Responsabilidades

- **Repositorio** (`lib/repositories/`): sólo persistencia. Consultas, filtros,
  paginación. Cero reglas de negocio. Extiende `BaseRepository`.
- **Servicio** (`lib/services/`): las reglas. Validaciones de dominio,
  transacciones, auditoría, generación de folios. Extiende `BaseService`.
- **Action** (`app/actions/`): capa delgada. Sólo declara esquema, permiso,
  rutas a revalidar y delega al servicio. **Nunca** contiene lógica ni llama a
  Prisma directo.
- **Página**: puede leer del repositorio directamente (lectura pura). Para
  escribir siempre pasa por una Action.

### Los 4 pilares de POO — dónde se aplican

| Pilar | Dónde |
|---|---|
| **Abstracción** | `BaseRepository` expone `findById`, `paginate`, `softDelete` con nombres del dominio y esconde Prisma. |
| **Encapsulamiento** | `delegate`, `audit`, `sequences` son `protected`. Nadie fuera de la jerarquía toca Prisma ni instancia servicios auxiliares. |
| **Herencia** | Todos los repos extienden `BaseRepository`; todos los servicios `BaseService`; todos los errores esperados `DomainError`. |
| **Polimorfismo** | `MovementStrategy` decide dirección y validaciones por tipo de movimiento; `executeAction` maneja cualquier `DomainError` sin conocer su clase concreta. |

### Patrones de diseño obligatorios

- **Repository** — acceso a datos.
- **Strategy** — `MovementStrategy` (Inbound / Outbound / Neutral) para los
  tipos de movimiento. Agregar un tipo nuevo = agregar una entrada al mapa
  `MOVEMENT_STRATEGIES`, sin tocar `InventoryService`.
- **Template Method** — `BaseRepository.paginate()` fija el algoritmo, las
  subclases aportan `where` y `orderBy`.
- **Facade** — `InventoryService` es la única puerta de entrada a mover stock.
- **Singleton** — cliente Prisma.

---

## 5. Reglas de código no negociables

1. **Nada de ternarias anidadas.** Una ternaria simple para un valor está bien.
   Dos o más niveles, o una ternaria que devuelve JSX complejo → conviértela en
   una función con `if`/`return` temprano, o en un diccionario `Record<K, V>`.

   ```ts
   // MAL
   const label = type === "FABRIC" ? "Tela" : type === "ZIPPER" ? "Cierre" : "Otro";

   // BIEN
   const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = { ... };
   const label = MATERIAL_TYPE_LABELS[type];
   ```

2. **Enums → español con diccionarios.** Todo `Record<Enum, string>` vive en
   `lib/constants/labels.ts`. Nunca traduzcas inline en un componente.

3. **Comentarios que explican el PORQUÉ**, no el qué. En español. Especialmente
   en reglas de negocio no obvias (por qué se bloquea la fila, por qué las mermas
   se componen y no se suman, por qué el saldo no se edita a mano).

4. **Nombres en inglés en el código** (modelos, variables, funciones);
   **texto de interfaz y comentarios en español**.

5. **Sin `any`.** Si Prisma obliga (delegados genéricos), aísla el `any` en un
   solo punto con `eslint-disable` y comenta por qué.

6. **Server Components por defecto.** `"use client"` sólo cuando haya estado,
   evento o hook del navegador. Un formulario es cliente; la lista que lo rodea
   no tiene por qué serlo.

7. **Zod valida dos veces:** en el formulario (RHF) y en el servidor
   (`executeAction`). El esquema es el mismo archivo, importado en ambos lados.

8. **`Decimal` de Prisma no cruza al cliente.** Conviértelo con `toPlainObject()`
   antes de pasarlo a un Client Component.

9. **Funciones cortas.** Si un método pasa de ~40 líneas, extrae.

10. **Un archivo, una responsabilidad.** Nada de `utils.ts` con 30 funciones sin
    relación.

---

## 6. Integridad del inventario — reglas sagradas

Estas tres se rompen sólo sobre mi cadáver:

1. **`Lot.currentQuantity` se escribe ÚNICAMENTE dentro de `InventoryService`**,
   en la misma transacción que crea el `Movement`. Si algún día los saldos no
   cuadran con el kárdex, es porque alguien escribió esa columna fuera de ahí.

2. **`Movement` y `AuditLog` son append-only.** Nunca `UPDATE`, nunca `DELETE`.
   Una corrección es OTRO movimiento de tipo `*_ADJUSTMENT` con su motivo.

3. **Antes de calcular un saldo se bloquea la fila** con
   `SELECT id FROM lots WHERE id = $1 FOR UPDATE` dentro de la transacción. Sin
   eso, dos cortes simultáneos del mismo rollo se pisan.

Además:

- Un `InventoryDocument` en `DRAFT` **no afecta existencias**. Sólo al pasar a
  `APPLIED` se generan los movimientos. Cancelar genera movimientos inversos,
  no borra.
- `disponible = currentQuantity − reservedQuantity`. Nunca se surte por encima
  del disponible.
- Al bajar de `Material.remnantThreshold`, el lote pasa a `REMNANT`
  automáticamente. Los retazos se ofrecen PRIMERO al surtir.

---

## 7. Auditoría — "quién metió mano"

Hay dos bitácoras y no se confunden:

- **`Movement`** responde *"¿qué pasó con este rollo?"* — el kárdex.
- **`AuditLog`** responde *"¿quién editó qué campo, cuándo y desde dónde?"* —
  guarda `oldValue`, `newValue`, `changedFields[]`, IP, user agent.

`AuditLog.sensitivity` clasifica el cambio: `LOW` / `MEDIUM` / `HIGH` /
`CRITICAL`. Las acciones `HIGH` y `CRITICAL` (ajustes de cantidad, bajas,
cancelaciones, cambios de rol, edición de ficha técnica activa) **exigen
`reason` obligatorio** y salen destacadas en el tablero de auditoría.

Se escribe siempre desde `AuditService`, nunca con un `prisma.auditLog.create`
suelto.

---

## 8. Autenticación y roles

BetterAuth con adaptador Prisma. Los modelos `User`, `Session`, `Account`,
`Verification` **deben respetar exactamente los nombres de campo que espera
BetterAuth** — no los "mejores".

`User.role` es `String` (lo exige el plugin `admin`). La seguridad de tipos se
recupera en `lib/constants/roles.ts`, que es la fuente única de verdad.

| Rol | Qué puede |
|---|---|
| `ADMIN` | Todo, incluido usuarios y configuración |
| `WAREHOUSE` | Todo el menú salvo Auditoría: entradas, salidas, cortes, conteos, ajustes, catálogos, fichas técnicas, cálculos y levantar requisiciones (no autorizarlas) |
| `PRODUCTION` | Consultar inventario, editar fichas técnicas, correr cálculos |
| `PURCHASING` | Consultar, crear y autorizar requisiciones |
| `MANAGEMENT` | Menú corto: Escanear · Cálculo · Tareas · Ayudantes. Edita tareas, ayudantes y cálculos; NO recorre el almacén ni ve auditoría |
| `READ_ONLY` | Sólo lectura |

`inventory:read` es consultar un dato; **`inventory:browse` es recorrer el
almacén** (rollos, catálogos, documentos, reportes). Están separados porque
Dirección entra sólo a lo suyo: sin `browse` se le caen del menú 18 destinos.
El destino de entrada tras el login NO es `/dashboard` fijo — lo resuelve
`landingRoute()` con el primer destino que el rol puede ver.

Los permisos son capacidades (`inventory:write`, `inventory:adjust`,
`catalog:write`…), no pantallas. `executeAction` exige el permiso antes de
ejecutar. El `proxy.ts` sólo hace la redirección optimista mirando la
cookie; **la autorización real siempre es en el servidor**.

---

## 9. Sistema visual — FLAT DESIGN

Es una decisión, no una preferencia. La app se usa en una bodega con luz mala.

**Prohibido:**
- Sombras (`shadow-*`), degradados, glassmorphism, blur.
- Bordes redondeados grandes. El radio del sistema es **4px**, punto.
- Animaciones decorativas. Sólo transiciones de color y estados de carga.

**Obligatorio:**
- Jerarquía por **bordes de 1px** y color de fondo sólido, nunca por elevación.
- Un solo acento: **ámbar industrial**. Se usa en la acción primaria y en el
  estado activo del nav. Nada más.
- Neutros fríos (slate). Los estados se comunican con fondo sólido:
  verde disponible, ámbar reservado, violeta retazo, rojo defectuoso.
- Clase `.flat-surface` = `border border-border bg-card`. Úsala para toda tarjeta.
- Clase `.tabular` (`font-variant-numeric: tabular-nums`) en **todo folio y toda
  cantidad**, para que las columnas de números se alineen.

Tokens en `app/globals.css` con `@theme inline` de Tailwind v4 y colores en
`oklch`. No hardcodees colores en componentes: usa las variables.

---

## 10. Móvil primero — el registro se hace en celular

- **Barra inferior fija** de máximo 4 destinos: Tablero · Inventario ·
  Escanear · Cálculo. Es la navegación principal en el piso.
- **Sidebar sólo en `md:` hacia arriba.** En celular no existe.
- **Área táctil mínima 44px.** Usa la utilidad `.touch-target`.
- Respeta el notch: `.safe-top` y `.safe-bottom` con `env(safe-area-inset-*)`.
- `userScalable: false` en el viewport: la app se usa con una mano y el zoom
  accidental estorba.
- En listas, en celular **tarjetas apiladas**, no tablas con scroll horizontal.
  La tabla aparece a partir de `md:`.
- Teclado correcto: `inputMode="decimal"` para metros, `inputMode="numeric"`
  para piezas, `inputMode="search"` para el buscador.
- La acción de corte debe lograrse en **2 toques** desde la ficha del rollo.

---

## 11. Filosofía de formularios

**Pocos campos obligatorios.** Si el auxiliar no puede dar de alta un rollo en
20 segundos, no va a usar el sistema y volverá a la libreta.

| Entidad | Obligatorio | Todo lo demás |
|---|---|---|
| Lote | material, cantidad, unidad | opcional |
| Material | código, nombre, tipo, unidad base | opcional |
| Ubicación | código, nombre | opcional |
| Cliente | nombre | opcional |
| Recepción | fecha | opcional |

Los campos opcionales van agrupados en secciones colapsables ("Detalles de
recepción", "Medidas"), no todos visibles de golpe.

Un `""` de un input opcional se convierte a `undefined` en Zod (`optionalText`),
nunca se guarda cadena vacía.

---

## 12. Consistencia entre inventario y movimientos

Esto es lo que hace que el sistema sirva:

- **Alta de lote**: se crea con `currentQuantity = 0` y se aplica un movimiento
  `RECEIPT_INITIAL`. Así el kárdex arranca completo desde el primer día y el
  saldo siempre es la suma de sus movimientos.
- **Reconteo**: la diferencia genera `RECEIPT_ADJUSTMENT` o `ISSUE_ADJUSTMENT`
  según el signo, con motivo obligatorio, y marca el lote como `verified`.
- **Traspaso**: movimiento `RECLASSIFICATION` con cantidad 0, cambiando
  `fromLocationId` → `toLocationId`. El saldo no se toca.
- En cualquier momento debe cumplirse:
  `Lot.currentQuantity === Σ(Movement.quantity WHERE lotId = lot.id)`.
  Escribe un script `scripts/verify-integrity.ts` que lo compruebe.

---

## 13. Convenciones de folios

Serie propia por entidad, correlativa por año, generada por `SequenceService`
con incremento atómico dentro de la transacción.

| Entidad | Formato |
|---|---|
| Lote | `R-2026-00841` |
| Recepción | `REC-2026-0142` |
| Entrada | `IN-2026-0341` |
| Salida | `OUT-2026-0912` |
| Movimiento | `MOV-2026-0000123` |
| Cálculo | `CALC-2026-0057` |
| Orden producción | `PO-2026-0113` |
| Requisición | `PR-2026-0074` |

El folio del lote es el contenido del QR: `https://{APP_URL}/r/{code}`.

---

## 14. Detalles del dominio textil que no debes perder

- **Grosor y onzas conviven.** Tela plana/técnica se especifica en
  `thicknessMm` (milímetros). **Mezclilla se especifica en `weightOz`**
  (oz/yd²: 10 oz, 12 oz, 14 oz). Ambos campos existen, ambos son opcionales, y
  en la interfaz se muestra el que esté lleno.
- **`shade` (tono/partida de tintura)** es distinto de `supplierLotNumber`.
  Si `Material.requiresShade === true` y el cálculo propone lotes de más de un
  tono, se emite advertencia.
- **Mermas se componen, no se suman.**
  `(1 + línea/100) × (1 + global/100) − 1`. 5% sobre 3% no es 8%.
- **Tallas escalan con `Size.consumptionFactor`** (CH 0.92, M 1.00, G 1.08,
  XG 1.16) en vez de duplicar la ficha técnica. Una `BomLine` con `sizeId`
  propio usa su valor tal cual, sin escalar.
- **Fichas técnicas versionadas.** Una ficha ya usada por un cálculo nunca se
  edita: se crea v2. Los cálculos guardan `bomId` para seguir siendo
  reproducibles.
- **Retazos**: al surtir se ofrecen primero (`orderBy: [{isRemnant: 'desc'},
  {receivedAt: 'asc'}]`), si no se acumulan en una esquina y se pierden.

---

## 15. La fórmula del motor de cálculo

Es el corazón del sistema. Vive en `CalculationService`:

```
base      = Σ [ piezas × consumoPorUnidad × factorTalla ]
requerido = base × (1 + merma/100) × (1 + mermaGlobal/100) × (1 + seguridad/100)
disponible = Σ lots.currentQuantity − Σ lots.reservedQuantity
             (filtrado por cliente dueño si respectOwnership = true)
faltante  = max(0, requerido − disponible − enTransito)
```

El resultado se guarda como **SNAPSHOT** en `CalculationRequirement`: si mañana
cambia la ficha o llega material nuevo, el cálculo viejo sigue mostrando los
números con los que se tomó la decisión.

Ejemplo que debe funcionar: *"Overol para gasera: 1 pieza = 2 m de tela +
4 cierres. Necesito 500 → 1,000 m de tela + 2,000 cierres"* (más merma).

---

## 16. Variables de entorno

```bash
DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://...neon.tech/neondb?sslmode=require"   # sin -pooler, para migraciones
BETTER_AUTH_SECRET="..."   # openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

`.env` va en `.gitignore`. Mantén un `.env.example` con los valores enmascarados.

---

## 17. Cómo trabajar conmigo

- **Antes de cada fase**, dime qué archivos vas a crear o tocar y espera mi ok.
- **No hagas fases que no te pedí.** Termina la actual, corre
  `npx tsc --noEmit` y `npm run build`, y reporta.
- Si una decisión tiene dos caminos razonables, **pregunta**, no elijas por mí.
- Si detectas que algo de este archivo está mal o se contradice, **dímelo**.
- No agregues features "por si acaso". MVP primero.
- Al terminar cada fase, dame un resumen corto: qué quedó, qué falta, qué
  decisiones tomaste.
