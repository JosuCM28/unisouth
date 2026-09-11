import {
  ROLE_VALUES,
  ROLE_LABELS,
  roleHasPermission,
  type Role,
} from "@/lib/constants/roles";
import {
  landingRoute,
  visibleSections,
  MOBILE_BAR_ITEMS,
} from "@/lib/constants/navigation";

/**
 * El menú que le toca a cada rol, comprobado contra lo acordado.
 *
 *   npm run verify:roles
 *
 * No consulta la base: sólo cruza la matriz de `roles.ts` con `NAVIGATION`.
 *
 * Existe porque el error más fácil de cometer aquí es silencioso: se agrega un
 * destino nuevo al menú con `inventory:browse` —que es lo que uno copia del
 * vecino— y el auxiliar de almacén termina viendo una pantalla que no le
 * tocaba, sin que nada falle ni avise. Este script lo grita.
 */

/** Lo acordado, destino por destino. Si cambia el acuerdo, cambia esta tabla. */
const ESPERADO: Record<Role, string[]> = {
  ADMIN: [
    "Tablero", "Inventario", "Escanear", "Cálculo",
    "Tareas", "Reglas",
    "Materiales", "Productos", "Prendas", "Tallas", "Foleos", "Talleres",
    "Almacenes", "Ubicaciones", "Clientes", "Producciones", "Proveedores",
    "Ayudantes",
    "Recepciones", "Salidas", "Órdenes", "Movimientos", "Documentos",
    "Requisiciones", "Reportes", "Auditoría",
    "Usuarios",
  ],

  /* Mueve el material, y nada más. Ésta es la lista que se acordó y la razón
     de ser de este script. */
  WAREHOUSE: [
    "Tablero", "Inventario", "Escanear",
    "Tareas",
    "Materiales", "Prendas", "Ubicaciones", "Clientes", "Proveedores",
    "Recepciones", "Salidas", "Órdenes", "Documentos",
  ],

  PRODUCTION: [
    "Tablero", "Inventario", "Escanear", "Cálculo",
    "Tareas", "Reglas",
    "Materiales", "Productos", "Prendas", "Tallas", "Foleos", "Talleres",
    "Almacenes", "Ubicaciones", "Clientes", "Producciones", "Proveedores",
    "Ayudantes",
    "Recepciones", "Salidas", "Órdenes", "Movimientos", "Documentos",
    "Reportes",
  ],

  PURCHASING: [
    "Tablero", "Inventario", "Escanear",
    "Tareas", "Reglas",
    "Materiales", "Productos", "Prendas", "Tallas", "Foleos", "Talleres",
    "Almacenes", "Ubicaciones", "Clientes", "Producciones", "Proveedores",
    "Ayudantes",
    "Recepciones", "Salidas", "Órdenes", "Movimientos", "Documentos",
    "Requisiciones", "Reportes",
  ],

  // El menú corto del contrato: cuatro destinos, ni uno más.
  MANAGEMENT: ["Escanear", "Cálculo", "Tareas", "Ayudantes"],

  READ_ONLY: [
    "Tablero", "Inventario", "Escanear",
    "Tareas", "Reglas",
    "Materiales", "Productos", "Prendas", "Tallas", "Foleos", "Talleres",
    "Almacenes", "Ubicaciones", "Clientes", "Producciones", "Proveedores",
    "Ayudantes",
    "Recepciones", "Salidas", "Órdenes", "Movimientos", "Documentos",
    "Reportes",
  ],
};

let fallos = 0;

for (const role of ROLE_VALUES) {
  const secciones = visibleSections(role, roleHasPermission);
  const real = secciones.flatMap((s) => s.items.map((i) => i.label));
  const barra = MOBILE_BAR_ITEMS.filter((i) => roleHasPermission(role, i.permission));

  const sobran = real.filter((d) => !ESPERADO[role].includes(d));
  const faltan = ESPERADO[role].filter((d) => !real.includes(d));

  const ok = sobran.length === 0 && faltan.length === 0;
  if (!ok) fallos += 1;

  console.log(
    `\n${ok ? "OK   " : "FALLA"} ${ROLE_LABELS[role]} (${role}) — ${real.length} destinos`,
  );
  console.log(`      entra en ${landingRoute(role, roleHasPermission)}`);
  console.log(`      barra movil: ${barra.map((i) => i.label).join(" · ") || "(vacia)"}`);

  for (const s of secciones) {
    console.log(`      ${s.label}: ${s.items.map((i) => i.label).join(", ")}`);
  }

  if (sobran.length) console.log(`      SOBRAN: ${sobran.join(", ")}`);
  if (faltan.length) console.log(`      FALTAN: ${faltan.join(", ")}`);
}

/* Que el destino de entrada exista de verdad: un rol al que no le toque
   ninguna pantalla aterrizaria en un error justo despues de teclear bien su
   contrasena. */
for (const role of ROLE_VALUES) {
  const destino = landingRoute(role, roleHasPermission);
  const visibles = visibleSections(role, roleHasPermission).flatMap((s) =>
    s.items.map((i) => i.href),
  );

  if (!visibles.includes(destino)) {
    console.log(`\nFALLA ${role} entra en ${destino}, que no esta en su menu`);
    fallos += 1;
  }
}

console.log(fallos === 0 ? "\nTODO BIEN" : `\n${fallos} FALLAS`);
process.exit(fallos === 0 ? 0 : 1);
