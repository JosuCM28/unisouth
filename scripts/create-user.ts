import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants/roles";

/**
 * Alta de usuarios desde la terminal.
 *
 * No hay pantalla de registro a propósito: al auxiliar lo da de alta el
 * administrador en persona, y dejar el registro abierto en una app de
 * inventario sería un agujero.
 *
 * Uso interactivo:
 *   npm run user:create
 *
 * Uso directo (para scripts o el primer administrador):
 *   npm run user:create -- --email juan@empresa.com --name "Juan Pérez" \
 *     --role WAREHOUSE --password "algo-largo"
 */

interface Args {
  email?: string;
  name?: string;
  role?: string;
  password?: string;
  phone?: string;
}

function parseArgs(): Args {
  const args: Args = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;

    const key = flag.slice(2) as keyof Args;
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      args[key] = value;
      i += 1;
    }
  }

  return args;
}

const rl = createInterface({ input: stdin, output: stdout });

/** Pregunta hasta que la respuesta pase la validación. */
async function ask(
  question: string,
  validate: (value: string) => string | null,
  fallback?: string,
): Promise<string> {
  if (fallback) {
    const error = validate(fallback);
    if (!error) return fallback;
    console.log(`  ✗ ${error}`);
  }

  for (;;) {
    const answer = (await rl.question(question)).trim();
    const error = validate(answer);
    if (!error) return answer;
    console.log(`  ✗ ${error}`);
  }
}

function validateEmail(value: string): string | null {
  if (!value) return "Escribe el correo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "El correo no es válido.";
  return null;
}

function validateName(value: string): string | null {
  if (!value) return "Escribe el nombre.";
  if (value.length < 3) return "El nombre es muy corto.";
  return null;
}

/** BetterAuth exige 8; se piden 10 porque esto abre el inventario completo. */
function validatePassword(value: string): string | null {
  if (!value) return "Escribe la contraseña.";
  if (value.length < 10) return "Mínimo 10 caracteres.";
  return null;
}

function validateRole(value: string): string | null {
  if (!value) return "Elige un rol.";
  const upper = value.toUpperCase();
  if (!ROLES.includes(upper as Role)) {
    return `Rol inválido. Opciones: ${ROLES.join(", ")}`;
  }
  return null;
}

/** Contraseña legible pero no adivinable, para dictarla por teléfono. */
function suggestPassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 14; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function main() {
  const args = parseArgs();

  console.log("\n═══ Alta de usuario — UNISOUTH ═══\n");

  const email = (
    await ask("Correo: ", validateEmail, args.email)
  ).toLowerCase();

  // Se comprueba ANTES de pedir el resto: no tiene caso capturar cinco
  // campos para descubrir al final que el correo ya existe.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`\n✗ Ya existe un usuario con ${email} (rol ${existing.role}).`);
    console.log("  Para cambiarle el rol usa: npm run user:role\n");
    return;
  }

  const name = await ask("Nombre completo: ", validateName, args.name);

  console.log("\n  Roles disponibles:");
  for (const role of ROLES) {
    console.log(`    ${role.padEnd(12)} ${ROLE_LABELS[role]}`);
  }

  const role = (
    await ask("\nRol: ", validateRole, args.role)
  ).toUpperCase() as Role;

  const suggested = suggestPassword();
  console.log(`\n  Sugerencia de contraseña: ${suggested}`);
  const password = await ask(
    "Contraseña (Enter para usar la sugerida): ",
    (value) => (value === "" ? null : validatePassword(value)),
    args.password,
  );
  const finalPassword = password || suggested;

  // Si todo vino por bandera, no se abre un prompt más: el script debe poder
  // correr sin interacción para el primer administrador o desde un pipeline.
  const isNonInteractive = Boolean(
    args.email && args.name && args.role && args.password,
  );
  const phone = isNonInteractive
    ? (args.phone ?? "")
    : (args.phone ?? (await rl.question("Teléfono (opcional): ")).trim());

  // BetterAuth hashea la contraseña y crea la cuenta.
  await auth.api.signUpEmail({ body: { email, password: finalPassword, name } });

  // El rol se asigna DESPUÉS: `input: false` impide mandarlo en el registro,
  // que es justo lo que evita que alguien se registre como ADMIN.
  const user = await prisma.user.update({
    where: { email },
    data: { role, phone: phone || null },
  });

  await prisma.auditLog.create({
    data: {
      entity: "User",
      entityId: user.id,
      action: "CREATE",
      reference: email,
      newValue: { email, name, role },
      changedFields: ["email", "name", "role"],
      sensitivity: "HIGH",
      reason: "Alta de usuario desde la terminal",
      userName: "script",
      source: "cli",
    },
  });

  console.log("\n✓ Usuario creado\n");
  console.log(`  Correo:     ${email}`);
  console.log(`  Nombre:     ${name}`);
  console.log(`  Rol:        ${role} (${ROLE_LABELS[role]})`);
  console.log(`  Contraseña: ${finalPassword}`);
  console.log("\n  Anota la contraseña: no se puede volver a consultar.\n");
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ No se pudo crear el usuario: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
