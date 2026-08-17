import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "@/lib/prisma";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils";

/**
 * Gestión de usuarios desde la terminal.
 *
 *   npm run user:list                       lista todos
 *   npm run user:role                       cambia el rol (interactivo)
 *   npm run user:role -- --email x --role Y  directo
 *   npm run user:disable -- --email x        desactiva sin borrar
 */

const command = process.argv[2] ?? "list";

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(3);

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      args[flag.slice(2)] = value;
      i += 1;
    }
  }

  return args;
}

async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      email: true,
      name: true,
      role: true,
      active: true,
      banned: true,
      createdAt: true,
    },
  });

  if (users.length === 0) {
    console.log("\nNo hay usuarios. Crea el primero con: npm run user:create\n");
    return;
  }

  console.log(`\n═══ ${users.length} usuario(s) ═══\n`);
  console.log(
    "  " +
      "CORREO".padEnd(30) +
      "NOMBRE".padEnd(22) +
      "ROL".padEnd(12) +
      "ESTADO".padEnd(10) +
      "ALTA",
  );
  console.log("  " + "─".repeat(84));

  for (const user of users) {
    console.log(
      "  " +
        user.email.padEnd(30) +
        user.name.slice(0, 20).padEnd(22) +
        user.role.padEnd(12) +
        describeStatus(user).padEnd(10) +
        formatDate(user.createdAt),
    );
  }

  console.log();
}

/** Con salidas tempranas: son tres estados, no dos. */
function describeStatus(user: { active: boolean; banned: boolean }): string {
  if (user.banned) return "bloqueado";
  if (!user.active) return "inactivo";
  return "activo";
}

async function changeRole() {
  const args = parseArgs();
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    let email = args.email;
    if (!email) {
      await listUsers();
      email = (await rl.question("Correo del usuario: ")).trim().toLowerCase();
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`\n✗ No existe un usuario con ${email}\n`);
      return;
    }

    console.log(`\n  ${user.name} — rol actual: ${user.role}\n`);
    console.log("  Roles disponibles:");
    for (const role of ROLES) {
      console.log(`    ${role.padEnd(12)} ${ROLE_LABELS[role]}`);
    }

    let role = args.role?.toUpperCase();
    while (!role || !ROLES.includes(role as Role)) {
      role = (await rl.question("\nNuevo rol: ")).trim().toUpperCase();
      if (!ROLES.includes(role as Role)) {
        console.log(`  ✗ Rol inválido. Opciones: ${ROLES.join(", ")}`);
        role = undefined;
      }
    }

    if (role === user.role) {
      console.log(`\n  ${user.name} ya tiene el rol ${role}. Sin cambios.\n`);
      return;
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role },
    });

    // Cambiar un rol es HIGH: reparte permisos sobre el inventario.
    await prisma.auditLog.create({
      data: {
        entity: "User",
        entityId: updated.id,
        action: "UPDATE",
        reference: email,
        oldValue: { role: user.role },
        newValue: { role },
        changedFields: ["role"],
        sensitivity: "HIGH",
        reason: "Cambio de rol desde la terminal",
        userName: "script",
        source: "cli",
      },
    });

    console.log(`\n✓ ${user.name}: ${user.role} → ${role}`);
    console.log(
      "\n  El cambio surte efecto en su próxima navegación: la sesión se",
      "\n  revalida contra la base en cada carga.\n",
    );
  } finally {
    rl.close();
  }
}

async function disableUser() {
  const args = parseArgs();
  const email = args.email?.toLowerCase();

  if (!email) {
    console.log("\nUso: npm run user:disable -- --email correo@empresa.com\n");
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`\n✗ No existe un usuario con ${email}\n`);
    return;
  }

  // Se desactiva, no se borra: sus movimientos y su rastro de auditoría
  // deben seguir apuntando a una persona con nombre.
  const updated = await prisma.user.update({
    where: { email },
    data: { active: false },
  });

  // La sesión abierta deja de servir de inmediato: getCurrentUser filtra
  // por `active`, así que no hay que esperar a que expire la cookie.
  await prisma.session.deleteMany({ where: { userId: updated.id } });

  await prisma.auditLog.create({
    data: {
      entity: "User",
      entityId: updated.id,
      action: "UPDATE",
      reference: email,
      oldValue: { active: true },
      newValue: { active: false },
      changedFields: ["active"],
      sensitivity: "HIGH",
      reason: "Desactivación desde la terminal",
      userName: "script",
      source: "cli",
    },
  });

  console.log(`\n✓ ${user.name} desactivado y sus sesiones cerradas.`);
  console.log("  Su historial se conserva.\n");
}

const COMMANDS: Record<string, () => Promise<void>> = {
  list: listUsers,
  role: changeRole,
  disable: disableUser,
};

async function main() {
  const handler = COMMANDS[command];

  if (!handler) {
    console.log(`\nComando desconocido: ${command}`);
    console.log(`Disponibles: ${Object.keys(COMMANDS).join(", ")}\n`);
    return;
  }

  await handler();
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Error: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
