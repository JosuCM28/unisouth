# UNISOUTH — Sistema de almacén textil

Control de inventario **rollo por rollo** para una fábrica de ropa industrial
(uniformes, overoles, pantalones) en Veracruz, México.

El usuario principal es el **auxiliar de almacén**: recibe insumos, los acomoda,
los entrega a producción y avisa cuándo hay que comprar. Trabaja de pie, con el
celular en una mano y un rollo de tela en la otra.

## Qué resuelve

Tres hechos del negocio definen todo el diseño:

1. **La tela no es de la fábrica.** Es del cliente que manda a maquilar. Varios
   clientes comparten la misma bodega, y jamás se surte material de uno a la
   producción de otro.
2. **Se rastrea rollo por rollo**, no por artículo. Cada rollo tiene folio,
   metraje vivo, tono de tintura y ubicación física. Mezclar dos tonos en un
   mismo tendido produce una prenda rechazada.
3. **La operación diaria ocurre en celular**, en una bodega con mala luz y WiFi
   intermitente. El escritorio es para reportes y catálogos.

## Instalación

```bash
npm install
```

```bash
npx prisma generate
```

```bash
npm run db:push
```

```bash
npm run db:seed
```

```bash
npm run dev
```

La app queda en `http://localhost:3000`.

## Variables de entorno

Copia `.env.example` a `.env` y llénalo:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Cadena de Neon **con** `-pooler`. La usa la app en runtime. |
| `DIRECT_URL` | La misma cadena **sin** `-pooler`. Prisma la necesita para migraciones; el pooler de Neon no las soporta. |
| `BETTER_AUTH_SECRET` | Genera con `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | `http://localhost:3000` en desarrollo. |
| `NEXT_PUBLIC_APP_URL` | Base del QR de cada rollo: `{APP_URL}/r/{code}`. |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Sirve la compilación |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenera el cliente de Prisma |
| `npm run db:push` | Sincroniza el esquema con la base |
| `npm run db:migrate` | Crea y aplica una migración |
| `npm run db:studio` | Explorador visual de la base |
| `npm run db:seed` | Datos base: tallas, ubicaciones, secuencias |
| `npm run verify:integrity` | **Verifica que cada saldo cuadre con su kárdex** |

## Arquitectura

El flujo va siempre en una sola dirección:

```
┌─────────────────────────────────────────────────────────────┐
│  LECTURA                          ESCRITURA                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Página                           Componente cliente        │
│  (Server Component)               (formulario, RHF + Zod)   │
│      │                                  │                   │
│      │                                  ▼                   │
│      │                            Server Action             │
│      │                            app/actions/              │
│      │                                  │                   │
│      │                                  ▼                   │
│      │                            executeAction()           │
│      │                            · exige permiso           │
│      │                            · valida con Zod          │
│      │                            · traduce errores         │
│      │                            · revalidatePath          │
│      │                                  │                   │
│      │                                  ▼                   │
│      │                            Servicio                  │
│      │                            lib/services/             │
│      │                            REGLAS DE NEGOCIO         │
│      │                                  │                   │
│      ▼                                  ▼                   │
│  ┌──────────────────────────────────────────────┐           │
│  │  Repositorio — lib/repositories/             │           │
│  │  Sólo persistencia. Cero reglas de negocio.  │           │
│  └──────────────────────────────────────────────┘           │
│                        │                                    │
│                        ▼                                    │
│                     Prisma                                  │
│                        │                                    │
│                        ▼                                    │
│              PostgreSQL 18 (Neon)                           │
└─────────────────────────────────────────────────────────────┘
```

### Responsabilidades

| Capa | Hace | No hace |
|---|---|---|
| **Página** | Resuelve datos y monta componentes | Lógica de negocio |
| **Action** | Declara esquema, permiso y rutas a revalidar | Tocar Prisma, decidir nada |
| **Servicio** | Valida reglas, transacciona, audita, genera folios | Consultar directo |
| **Repositorio** | Consultas, filtros, paginación | Reglas de negocio |

### El corazón: `InventoryService`

Es la **única puerta** para mover existencias:

```
applyMovementWithin(tx, request)
  ├── 1. lockLot()     SELECT id FROM lots WHERE id = $1 FOR UPDATE
  ├── 2. strategy.validate(lot, quantity)
  ├── 3. balanceBefore = lot.currentQuantity
  ├── 4. delta = strategy.signedQuantity(quantity)
  ├── 5. folio con SequenceService (dentro de la transacción)
  ├── 6. crea el Movement  ← append-only
  ├── 7. resolveStatus()   ← DEPLETED / REMNANT / AVAILABLE
  └── 8. escribe Lot.currentQuantity  ← la ÚNICA escritura del sistema
```

El `FOR UPDATE` no es decorativo: sin él, dos cortes simultáneos del mismo
rollo leen el mismo saldo y el segundo pisa al primero.

**Invariante que sostiene todo:**

```
Lot.currentQuantity === Σ(Movement.quantity WHERE lotId = lot.id)
```

`npm run verify:integrity` la comprueba sobre toda la base.

### Patrones

| Patrón | Dónde |
|---|---|
| **Repository** | `lib/repositories/` sobre `BaseRepository` |
| **Strategy** | `MOVEMENT_STRATEGIES`: Inbound / Outbound / Neutral |
| **Template Method** | `BaseRepository.paginate()` |
| **Facade** | `InventoryService` como única entrada al stock |
| **Singleton** | Cliente de Prisma |

## Reglas sagradas

1. `Lot.currentQuantity` se escribe **únicamente** dentro de
   `InventoryService`, en la misma transacción que crea su `Movement`.
2. `Movement` y `AuditLog` son **append-only**. Una corrección es otro
   movimiento de ajuste con su motivo, nunca un `UPDATE` ni un `DELETE`.
3. Antes de calcular un saldo se **bloquea la fila** con `FOR UPDATE`.
4. Un documento en `DRAFT` **no afecta existencias**. Sólo al aplicarlo se
   generan movimientos; cancelarlo genera movimientos inversos.
5. `disponible = currentQuantity − reservedQuantity`. Nunca se surte por
   encima del disponible.

## Motor de cálculo

```
base       = Σ [ piezas × consumoPorUnidad × factorTalla ]
requerido  = base × (1 + merma/100) × (1 + seguridad/100)
disponible = Σ currentQuantity − Σ reservedQuantity
faltante   = max(0, requerido − disponible − enTransito)
```

**Las mermas se componen, no se suman:** 5% sobre 3% da 8.15%, no 8%.

Caso de referencia: overol para gasera = 2 m de tela + 4 cierres por pieza.
Pidiendo 500 → 1,000 m y 2,000 cierres, más merma.

El resultado se congela como **snapshot** en `CalculationRequirement`: si
mañana cambia la ficha o llega material, el cálculo viejo sigue mostrando los
números con los que se tomó la decisión.

## Roles

| Rol | Puede |
|---|---|
| `ADMIN` | Todo |
| `WAREHOUSE` | Entradas, salidas, cortes, conteos, ajustes, catálogos |
| `PRODUCTION` | Consultar, editar fichas técnicas, correr cálculos |
| `PURCHASING` | Consultar, crear y autorizar requisiciones |
| `MANAGEMENT` | Sólo lectura, reportes y auditoría |
| `READ_ONLY` | Sólo lectura |

Los permisos son capacidades (`inventory:write`, `inventory:adjust`,
`catalog:write`…), no pantallas. `proxy.ts` sólo hace redirección optimista;
**la autorización real siempre ocurre en el servidor**.

## Diseño visual

Flat, por decisión: la app se usa en una bodega con mala luz.

- Sin sombras, degradados ni blur. Jerarquía por bordes de 1px.
- Radio de 4px en todo el sistema.
- Un solo acento: ámbar industrial, para la acción primaria y el nav activo.
- Estados con fondo sólido: verde disponible, ámbar reservado, violeta
  retazo, rojo defectuoso.
- Área táctil mínima de 44px; barra inferior de 4 destinos en celular.

## Estructura

```
app/
  actions/              Server Actions, una por dominio
  (auth)/login/         Ruta pública
  (dashboard)/          Rutas privadas con sidebar
  api/auth/[...all]/    Handler de BetterAuth
  api/export/           Descargas CSV
  print/                Vistas imprimibles (sin navegación)
  r/[code]/             Redirección corta del QR
components/
  ui/                   shadcn (generado por CLI, no editar a mano)
  layout/ shared/       Transversales
  lots/ materials/ …    Uno por dominio
lib/
  core/                 Errores, repositorio base, auditoría, sesión
  repositories/         Acceso a datos
  services/             Reglas de negocio
  validations/          Esquemas Zod
  constants/            Enums, etiquetas, navegación, roles
prisma/
  schema.prisma  seed.ts
scripts/
  verify-integrity.ts
proxy.ts                Redirección optimista (antes middleware.ts)
```

## Stack

Next.js 16 · React 19 · TypeScript estricto · PostgreSQL 18 (Neon) ·
Prisma 6 · BetterAuth · shadcn/ui · Tailwind CSS v4 · React Hook Form + Zod

## Despliegue en Dokploy

### 1. Crear la aplicación

En Dokploy: **Create Application** → tipo **Dockerfile**, apuntando al repositorio.
El `Dockerfile` de la raíz ya está listo; no hace falta configurar el build.

### 2. Variables de entorno

Son cinco. En **Environment** de la aplicación:

```
DATABASE_URL=postgresql://usuario:password@unisouth-db:5432/unisouth
DIRECT_URL=postgresql://usuario:password@unisouth-db:5432/unisouth
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://tu-dominio.com
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

#### Si la base está DENTRO de Dokploy

El host es el **nombre del servicio** en la red interna de Docker
(`unisouth-db` en el ejemplo), no `localhost`: desde el contenedor de la app,
`localhost` es él mismo. Dokploy muestra ese nombre en la pestaña del
servicio de base de datos.

`DATABASE_URL` y `DIRECT_URL` llevan **exactamente la misma cadena**. La
diferencia entre ambas sólo existe en Neon, que tiene un endpoint con pooler
para runtime y otro directo para migraciones. Un Postgres normal no tiene esa
separación, pero Prisma exige las dos variables porque el `schema.prisma` las
declara.

Tampoco lleva `sslmode=require`: el tráfico no sale del host, va por la red
interna de Docker.

#### Si la base está en Neon

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require&channel_binding=require
DIRECT_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require
```

Misma contraseña, mismo host, pero `DIRECT_URL` va **sin** `-pooler` y sin
`channel_binding`.

### 3. Build arg (el paso que se olvida)

`NEXT_PUBLIC_APP_URL` se **hornea en el bundle del cliente** durante la
compilación: es la base del QR de cada rollo. Además de la variable de
entorno, hay que declararla en **Build Args** con el mismo valor.

Si se omite, los QR apuntarán a `undefined/r/R-2026-00001` y el escáner no
resolverá ningún folio.

### 4. Dominio y puerto

En **Domains**: tu dominio, puerto **3000**, y activa **HTTPS** (Let's Encrypt).
`BETTER_AUTH_URL` y `NEXT_PUBLIC_APP_URL` deben usar `https://`, o la cookie
de sesión —que va con `secure` en producción— no se guardará.

### 5. Primer despliegue

El esquema hay que aplicarlo una vez. Con la base dentro de Dokploy, publica
temporalmente el puerto **5432** en el servicio de Postgres, apunta tu `.env`
local al host público del VPS, y corre los comandos desde tu máquina.

**Vuelve a cerrar el puerto en cuanto termines:** un Postgres abierto a
internet recibe intentos de acceso en cuestión de horas.

```bash
npm run db:push
```

```bash
npm run db:seed
```

El contenedor **no corre migraciones al arrancar**: hacerlo dejaría que dos
réplicas intentaran migrar a la vez, y un `db push` a medias es peor que uno
que no ocurrió. Es un paso deliberado y manual.

### 6. Crear el primer administrador

No hay pantalla de registro: los usuarios los da de alta el administrador. El
primero se crea con un script, y después se le cambia el rol:

```bash
npx tsx -e "import('./lib/auth').then(async ({auth}) => { await auth.api.signUpEmail({body:{email:'tu@correo.com',password:'CAMBIA_ESTO',name:'Tu Nombre'}}); console.log('listo'); })"
```

Luego, en Neon o con `npm run db:studio`, cambia su `role` a `ADMIN`.

### Verificación post-deploy

```bash
npm run verify:integrity
```

Conviene dejarlo en un cron: es lo que detecta si algún día un saldo deja de
cuadrar con su kárdex.

### Notas del contenedor

- Corre como usuario **sin privilegios** (`nextjs`, uid 1001).
- Imagen final de ~180 MB gracias a `output: standalone`.
- El cliente de Prisma se genera **dentro** del contenedor, para que el motor
  sea el de Alpine (musl) y no el de la máquina de desarrollo.
- El `HEALTHCHECK` pega a `/login`, que es público y no toca la base.
- `.dockerignore` excluye `.env`: los secretos se inyectan como variables del
  servicio, nunca horneados en una capa de la imagen.

## Gestión de usuarios

No hay pantalla de registro: al auxiliar lo da de alta el administrador. Los
usuarios se manejan desde la terminal.

### Crear un usuario

```bash
npm run user:create
```

Pregunta correo, nombre, rol y contraseña. Sugiere una contraseña legible por
si hay que dictarla por teléfono; se acepta con Enter.

Sin interacción, para el primer administrador o un pipeline:

```bash
npm run user:create -- --email juan@empresa.com --name "Juan Pérez" --role WAREHOUSE --password "unaContraseñaLarga"
```

### Ver quién existe

```bash
npm run user:list
```

### Cambiar el rol

```bash
npm run user:role
```

O directo:

```bash
npm run user:role -- --email juan@empresa.com --role PURCHASING
```

El cambio surte efecto en su siguiente navegación: la sesión se revalida
contra la base en cada carga.

### Dar de baja

```bash
npm run user:disable -- --email juan@empresa.com
```

Se **desactiva**, no se borra: sus movimientos y su rastro de auditoría deben
seguir apuntando a una persona con nombre. Sus sesiones abiertas se cierran de
inmediato.

### Los roles

| Rol | Para quién |
|---|---|
| `ADMIN` | Todo, incluidos usuarios y configuración |
| `WAREHOUSE` | El auxiliar: entradas, salidas, cortes, conteos, ajustes |
| `PRODUCTION` | Consulta inventario, edita fichas técnicas, corre cálculos |
| `PURCHASING` | Consulta, crea y autoriza requisiciones |
| `MANAGEMENT` | Sólo lectura, reportes y auditoría |
| `READ_ONLY` | Sólo lectura |

Toda alta, cambio de rol y baja queda en la bitácora con sensibilidad `HIGH`,
visible en `/audit`.

## Ayudantes de descarga

Las personas que bajan el material del camión. **No son usuarios del sistema**:
nunca entran a la app, sólo se les nombra en cada rollo para poder calcular su
bonificación.

### Dónde

Sidebar → **Catálogos → Ayudantes** (`/helpers`).

La pantalla muestra cuántos rollos ha bajado cada uno y la cantidad total, que
es la base del pago extra.

### Cómo se asigna

Al capturar rollos en `/receipts/new`, **cada renglón** tiene un campo
"Ayudante que lo bajó". Va por rollo y no por recepción porque dos personas
pueden repartirse un mismo camión y cada una cobra lo suyo.

Si llega alguien que no está dado de alta, el botón **+** junto al select lo
registra sin salir de la captura.

### Por qué no se pueden borrar

Un ayudante con rollos descargados **no se elimina**, se desactiva: su
historial sostiene las bonificaciones que ya se le pagaron, y borrarlo dejaría
esos rollos sin responsable.

### La cantidad que cuenta

Se usa `initialQuantity`, no `currentQuantity`: se le paga por lo que bajó del
camión, no por lo que queda después de los cortes.
