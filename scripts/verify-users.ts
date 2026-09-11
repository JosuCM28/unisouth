import "dotenv/config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/lib/services/user.service";

/**
 * Comprueba las reglas de acceso de UserService contra la base REAL.
 *
 *   npm run verify:users
 *
 * Todo corre dentro de una transacción que se revierte al terminar: no queda
 * ni un usuario, ni una sesión, ni una línea de bitácora escrita. Por eso se
 * puede correr contra la base de trabajo sin ensuciarla.
 *
 * Existe porque estas reglas no se pueden probar a mano sin romper algo: para
 * verificar que el sistema no se queda sin administradores habría que
 * quedarse sin administradores.
 */

const ROLLBACK = "ROLLBACK_DE_LA_PRUEBA";
let fallos = 0;

function check(nombre: string, ok: boolean, detalle = "") {
  if (!ok) fallos += 1;
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
}

async function esperaError(nombre: string, work: () => Promise<unknown>, fragmento: string) {
  try {
    await work();
    check(nombre, false, "no lanzó error");
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    if (mensaje === ROLLBACK) throw error;
    check(nombre, mensaje.includes(fragmento), mensaje);
  }
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", deletedAt: null } });
  if (!admin) throw new Error("No hay ADMIN en la base");

  try {
    await prisma.$transaction(async (tx) => {
      const ctx = { userId: admin.id, userName: admin.name, source: "prueba" };
      const service = new UserService(ctx, tx);

      // 1. Alta con contraseña
      const creado = await service.create({
        name: "Prueba Temporal",
        email: "PRUEBA.Temporal@Unisouth.mx",
        password: "contrasena-larga-1",
        role: "WAREHOUSE",
        phone: undefined,
      });
      check("crea usuario", creado.role === "WAREHOUSE");
      check("normaliza el correo a minúsculas", creado.email === "prueba.temporal@unisouth.mx", creado.email);

      // 2. La cuenta de credenciales existe y la contraseña se verifica con
      //    la MISMA función que usa BetterAuth al iniciar sesión.
      const cuenta = await tx.account.findFirst({
        where: { userId: creado.id, providerId: "credential" },
      });
      check("crea la cuenta de credenciales", Boolean(cuenta?.password));

      const { password } = await auth.$context;
      const valida = await password.verify({
        hash: cuenta!.password!,
        password: "contrasena-larga-1",
      });
      check("la contraseña se verifica como en el login", valida === true);

      const invalida = await password.verify({
        hash: cuenta!.password!,
        password: "otra-cosa-distinta",
      });
      check("rechaza una contraseña incorrecta", invalida === false);

      // 3. Correo duplicado
      await esperaError(
        "rechaza correo duplicado",
        () => service.create({
          name: "Otro", email: "prueba.temporal@unisouth.mx",
          password: "contrasena-larga-2", role: "READ_ONLY", phone: undefined,
        }),
        "Ya existe",
      );

      // 4. Autoprotección
      await esperaError("no se cambia el rol a sí mismo",
        () => service.changeRole({ id: admin.id, role: "READ_ONLY", reason: "x" }),
        "No puedes");
      await esperaError("no se suspende a sí mismo",
        () => service.setSuspended({ id: admin.id, suspended: true, reason: "x" }),
        "No puedes");
      await esperaError("no se da de baja a sí mismo",
        () => service.remove(admin.id, "x"),
        "No puedes");
      await esperaError("no se cierra sus propias sesiones",
        () => service.closeSessions(admin.id),
        "No puedes");

      // 5. Último administrador: se prueba con OTRO admin creado al vuelo,
      //    para que la regla se dispare por ser el único y no por ser uno mismo.
      const otroAdmin = await service.create({
        name: "Admin Temporal", email: "admin.temporal@unisouth.mx",
        password: "contrasena-larga-3", role: "ADMIN", phone: undefined,
      });
      // Con dos admins vivos, bajarle el rol a uno SÍ se permite.
      const degradado = await service.changeRole({
        id: otroAdmin.id, role: "WAREHOUSE", reason: "prueba",
      });
      check("permite degradar a un admin si queda otro", degradado.role === "WAREHOUSE");

      /* Ahora al revés: se deja UN solo administrador activo que no sea el
         actor, para que la regla se dispare por ser el último. El admin real
         se degrada por fuera del servicio —es utilería de la prueba, y todo
         esto se revierte igual. */
      const ultimo = await service.create({
        name: "Ultimo Admin", email: "ultimo.temporal@unisouth.mx",
        password: "contrasena-larga-5", role: "ADMIN", phone: undefined,
      });
      await tx.user.update({ where: { id: admin.id }, data: { role: "WAREHOUSE" } });
      check("queda un solo admin activo",
        (await tx.user.count({
          where: { role: "ADMIN", active: true, banned: false, deletedAt: null },
        })) === 1);

      await esperaError("NO degrada al último administrador",
        () => service.changeRole({ id: ultimo.id, role: "READ_ONLY", reason: "x" }),
        "único administrador activo");
      await esperaError("NO suspende al último administrador",
        () => service.setSuspended({ id: ultimo.id, suspended: true, reason: "x" }),
        "único administrador activo");
      await esperaError("NO da de baja al último administrador",
        () => service.remove(ultimo.id, "x"),
        "único administrador activo");

      // Se devuelve el rol al admin real para que el resto de la prueba corra
      // en las mismas condiciones que la base de verdad.
      await tx.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });

      // 6. Suspensión: escribe banned Y active, y cierra sesiones
      const suspendido = await service.setSuspended({
        id: creado.id, suspended: true, reason: "prueba de suspensión",
      });
      check("suspender escribe banned", suspendido.banned === true);
      check("suspender escribe active=false", suspendido.active === false);
      check("guarda el motivo del bloqueo", suspendido.banReason === "prueba de suspensión");

      await esperaError("no suspende dos veces",
        () => service.setSuspended({ id: creado.id, suspended: true, reason: "otra vez" }),
        "ya está suspendido");

      const reactivado = await service.setSuspended({
        id: creado.id, suspended: false, reason: "prueba de reactivación",
      });
      check("reactivar limpia banned", reactivado.banned === false && reactivado.active === true);
      check("reactivar limpia el motivo", reactivado.banReason === null);

      // 7. Baja lógica: marca deletedAt y ADEMÁS corta el acceso
      const baja = await service.remove(creado.id, "prueba de baja");
      check("la baja marca deletedAt", baja.deletedAt !== null);
      check("la baja también bloquea el login", baja.banned === true);

      const sigueEnLaBase = await tx.user.findUnique({ where: { id: creado.id } });
      check("NO borra la fila", sigueEnLaBase !== null);

      await esperaError("no suspende a un dado de baja",
        () => service.setSuspended({ id: creado.id, suspended: true, reason: "x" }),
        "está dado de baja");

      await esperaError("avisa que el correo lo tiene un dado de baja",
        () => service.create({
          name: "Recontratado", email: "prueba.temporal@unisouth.mx",
          password: "contrasena-larga-4", role: "READ_ONLY", phone: undefined,
        }),
        "dado de baja");

      // 8. Reactivación de la baja
      const restaurado = await service.restore(creado.id, "prueba de reactivación");
      check("restaurar limpia deletedAt", restaurado.deletedAt === null);
      check("restaurar devuelve el acceso", restaurado.banned === false && restaurado.active === true);
      check("restaurar conserva el rol", restaurado.role === "WAREHOUSE");

      // 9. La bitácora quedó escrita y sin rastro de contraseñas
      const logs = await tx.auditLog.findMany({
        where: { entity: "User", entityId: creado.id },
        orderBy: { createdAt: "asc" },
      });
      check("deja rastro en la auditoría", logs.length >= 5, `${logs.length} registros`);
      check("todos los cambios graves llevan motivo",
        logs.every((l) => !["HIGH", "CRITICAL"].includes(l.sensitivity) || Boolean(l.reason)));

      const crudo = JSON.stringify(logs);
      check("la bitácora NO guarda contraseñas", !crudo.includes("contrasena-larga"));
      check("la bitácora NO guarda hashes", !crudo.includes(cuenta!.password!.slice(0, 20)));
      check("la bitácora NO guarda pinHash", !crudo.includes("pinHash"));

      throw new Error(ROLLBACK);
    }, { timeout: 60000, maxWait: 20000 });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error;
  }

  const quedaron = await prisma.user.count({
    where: { email: { contains: "temporal@unisouth.mx" } },
  });
  check("la transacción se revirtió: no quedó nada", quedaron === 0);

  console.log(fallos === 0 ? "\nTODO BIEN" : `\n${fallos} FALLAS`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
