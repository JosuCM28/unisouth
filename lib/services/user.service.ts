import type { User } from "@prisma/client";
import { auth } from "@/lib/auth";
import { ROLE_LABELS, toRole, type Role } from "@/lib/constants/roles";
import { userStatus } from "@/lib/constants/user-status";
import type { PrismaExecutor } from "@/lib/prisma";
import {
  BusinessRuleError,
  DuplicateError,
  NotFoundError,
} from "@/lib/core/errors";
import type {
  UserCreateInput,
  UserPasswordInput,
  UserRoleInput,
  UserSuspendInput,
  UserUpdateInput,
} from "@/lib/validations/user.schema";
import { BaseService } from "./base.service";

/**
 * Un usuario listo para cruzar al cliente y para copiarse en la bitácora.
 *
 * `pinHash` queda fuera: nunca debe salir del servidor ni quedar guardado en
 * `AuditLog.oldValue`, porque la bitácora se exporta a Excel y se imprime.
 */
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  active: boolean;
  banned: boolean;
  banReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

/**
 * Altas, bajas y accesos de las personas que usan el sistema.
 *
 * Tres reglas mandan sobre todo lo demás:
 *
 *  1. NUNCA se borra un usuario de verdad. Sus rollos, movimientos y firmas lo
 *     apuntan con una relación opcional, así que un DELETE dejaría en NULL
 *     "quién recibió este rollo" en todo el historial: se perdería justo la
 *     trazabilidad que justifica el sistema.
 *  2. Siempre debe quedar al menos un administrador en pie. Sin eso nadie
 *     puede volver a entrar a esta pantalla y el sistema queda sin dueño.
 *  3. Quitar el acceso escribe `banned` Y `active` a la vez. BetterAuth sólo
 *     mira `banned` al crear la sesión y la app sólo mira `active`; escribir
 *     una sola dejaría a alguien iniciando sesión "bien" para que la app lo
 *     rebote un segundo después con un error que no explica nada.
 */
export class UserService extends BaseService {
  async create(input: UserCreateInput): Promise<SafeUser> {
    /* El hash va ANTES de abrir la transacción: scrypt tarda a propósito
       cientos de milisegundos, y esperarlo con la transacción abierta
       mantendría tomada una conexión del pool sin estar haciendo nada. */
    const passwordHash = await this.hashPassword(input.password);
    const email = this.normalizeEmail(input.email);

    return this.transaction(async (tx) => {
      await this.assertEmailAvailable(tx, email);

      const user = await tx.user.create({
        data: {
          name: input.name,
          email,
          phone: input.phone,
          role: input.role,
          active: true,
          // No hay correo de verificación: al auxiliar lo da de alta el
          // administrador en persona y muchos no tienen correo de empresa.
          emailVerified: false,
        },
      });

      /* Sin esta fila el usuario existe pero NO puede entrar: BetterAuth
         busca la contraseña en `account`, no en `user`. `accountId` es el
         propio id porque en el proveedor "credential" la cuenta es la
         persona, no un identificador que dé un tercero. */
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: passwordHash,
        },
      });

      await this.auditWith(tx).record({
        entity: "User",
        entityId: user.id,
        action: "CREATE",
        reference: user.email,
        newValue: this.toSafeUser(user),
        sensitivity: "HIGH",
        reason: `Alta de ${user.name} con rol ${ROLE_LABELS[toRole(user.role)]}`,
      });

      return this.toSafeUser(user);
    });
  }

  /** Nombre, correo y teléfono. El rol y la contraseña van por su lado. */
  async update(input: UserUpdateInput): Promise<SafeUser> {
    const email = this.normalizeEmail(input.email);

    return this.transaction(async (tx) => {
      const before = await this.findOrThrow(tx, input.id);
      await this.assertEmailAvailable(tx, email, input.id);

      const user = await tx.user.update({
        where: { id: input.id },
        data: { name: input.name, email, phone: input.phone ?? null },
      });

      await this.auditWith(tx).record({
        entity: "User",
        entityId: user.id,
        action: "UPDATE",
        reference: user.email,
        oldValue: this.toSafeUser(before),
        newValue: this.toSafeUser(user),
        sensitivity: "MEDIUM",
      });

      return this.toSafeUser(user);
    });
  }

  /**
   * Cambio de rol.
   *
   * NO se cierran sus sesiones: `getCurrentUser()` relee el rol de la base en
   * cada petición, así que el rol nuevo aplica desde el siguiente clic.
   * Sacarlo del sistema a media captura sólo para "refrescarle el menú" sería
   * molestarlo sin ganar nada.
   */
  async changeRole(input: UserRoleInput): Promise<SafeUser> {
    this.assertNotSelf(input.id, "cambiarte el rol a ti mismo");

    return this.transaction(async (tx) => {
      const before = await this.findOrThrow(tx, input.id);

      if (toRole(before.role) === input.role) {
        throw new BusinessRuleError(
          `${before.name} ya tiene el rol ${ROLE_LABELS[input.role]}.`,
          "role",
        );
      }

      // Bajarle el rol al último administrador deja el sistema sin dueño.
      if (input.role !== "ADMIN") {
        await this.assertNotLastAdmin(tx, before, "cambiarle el rol");
      }

      const user = await tx.user.update({
        where: { id: input.id },
        data: { role: input.role },
      });

      await this.auditWith(tx).record({
        entity: "User",
        entityId: user.id,
        action: "UPDATE",
        reference: user.email,
        oldValue: { role: before.role },
        newValue: { role: user.role },
        sensitivity: "CRITICAL",
        reason: input.reason,
      });

      return this.toSafeUser(user);
    });
  }

  /**
   * Le pone contraseña nueva a alguien y lo saca de todos lados.
   *
   * Se cierran sus sesiones a propósito: si se le cambia la contraseña porque
   * se sospecha que alguien más la sabía, dejar viva la sesión de ese alguien
   * haría inútil el cambio.
   *
   * La ÚNICA excepción es cambiársela uno mismo, y no por comodidad: al
   * borrar la propia sesión la cookie del navegador sigue ahí, y el proxy
   * —que sólo mira si la cookie existe— mandaría a `/`, que al no encontrar
   * sesión manda a `/login`, que por la cookie vuelve a `/`. Ciclo infinito.
   * Además no hay a quién echar: quien cambia la contraseña es quien la sabe.
   */
  async resetPassword(input: UserPasswordInput): Promise<SafeUser> {
    const passwordHash = await this.hashPassword(input.password);

    return this.transaction(async (tx) => {
      const user = await this.findOrThrow(tx, input.id);

      const credential = await tx.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
      });

      /* Puede no existir: una cuenta creada sin contraseña quedó sin fila en
         `account` y nunca pudo entrar. Ésta es la forma de rescatarla. */
      if (credential) {
        await tx.account.update({
          where: { id: credential.id },
          data: { password: passwordHash },
        });
      } else {
        await tx.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: passwordHash,
          },
        });
      }

      const isSelf = input.id === this.context.userId;
      const closed = isSelf ? 0 : await this.closeSessionsWith(tx, user.id);

      await this.auditWith(tx).record({
        entity: "User",
        entityId: user.id,
        action: "UPDATE",
        reference: user.email,
        /* Ni la contraseña ni su hash entran a la bitácora: lo que hay que
           poder auditar es que se cambió, quién lo hizo y por qué. */
        oldValue: { password: "(anterior)", sesiones: closed },
        newValue: { password: "(nueva)", sesiones: isSelf ? closed : 0 },
        sensitivity: "CRITICAL",
        reason: input.reason,
      });

      return this.toSafeUser(user);
    });
  }

  /** Suspender o reactivar: es la llave del acceso, no la baja. */
  async setSuspended(input: UserSuspendInput): Promise<SafeUser> {
    if (input.suspended) {
      this.assertNotSelf(input.id, "suspenderte a ti mismo");
    }

    return this.transaction(async (tx) => {
      const before = await this.findOrThrow(tx, input.id);

      if (before.deletedAt) {
        throw new BusinessRuleError(
          `${before.name} está dado de baja. Reactívalo primero para poder cambiarle el acceso.`,
        );
      }

      const status = userStatus(before);

      if (input.suspended && status === "SUSPENDED") {
        throw new BusinessRuleError(`${before.name} ya está suspendido.`);
      }
      if (!input.suspended && status === "ACTIVE") {
        throw new BusinessRuleError(`${before.name} ya tiene el acceso activo.`);
      }

      if (input.suspended) {
        await this.assertNotLastAdmin(tx, before, "suspenderlo");
      }

      const user = await tx.user.update({
        where: { id: input.id },
        data: this.accessFlags(input.suspended, input.reason),
      });

      if (input.suspended) await this.closeSessionsWith(tx, user.id);

      await this.auditWith(tx).record({
        entity: "User",
        entityId: user.id,
        action: "UPDATE",
        reference: user.email,
        oldValue: { estado: userStatus(before) },
        newValue: { estado: userStatus(user) },
        sensitivity: "CRITICAL",
        reason: input.reason,
      });

      return this.toSafeUser(user);
    });
  }

  /**
   * Baja lógica.
   *
   * Marca `deletedAt` y además corta el acceso: `deletedAt` lo respeta la app
   * pero BetterAuth no lo conoce, así que sin `banned` el dado de baja
   * seguiría iniciando sesión "correctamente".
   */
  async remove(id: string, reason: string): Promise<SafeUser> {
    this.assertNotSelf(id, "darte de baja a ti mismo");

    return this.transaction(async (tx) => {
      const before = await this.findOrThrow(tx, id);

      if (before.deletedAt) {
        throw new BusinessRuleError(`${before.name} ya estaba dado de baja.`);
      }

      await this.assertNotLastAdmin(tx, before, "darlo de baja");

      const user = await tx.user.update({
        where: { id },
        data: { ...this.accessFlags(true, reason), deletedAt: new Date() },
      });

      await this.closeSessionsWith(tx, id);

      await this.auditWith(tx).record({
        entity: "User",
        entityId: id,
        action: "DELETE",
        reference: user.email,
        oldValue: this.toSafeUser(before),
        newValue: this.toSafeUser(user),
        sensitivity: "CRITICAL",
        reason,
      });

      return this.toSafeUser(user);
    });
  }

  /**
   * Deshace la baja.
   *
   * Tiene que existir: el correo es único en la base y el índice no distingue
   * bajas, así que sin reactivación el correo de quien se dio de baja queda
   * quemado y al recontratarlo habría que inventarle uno nuevo.
   */
  async restore(id: string, reason: string): Promise<SafeUser> {
    return this.transaction(async (tx) => {
      const before = await this.findOrThrow(tx, id);

      if (!before.deletedAt) {
        throw new BusinessRuleError(`${before.name} no está dado de baja.`);
      }

      const user = await tx.user.update({
        where: { id },
        data: { ...this.accessFlags(false), deletedAt: null },
      });

      await this.auditWith(tx).record({
        entity: "User",
        entityId: id,
        action: "UPDATE",
        reference: user.email,
        oldValue: this.toSafeUser(before),
        newValue: this.toSafeUser(user),
        sensitivity: "HIGH",
        reason,
      });

      return this.toSafeUser(user);
    });
  }

  /**
   * Lo saca de todos los equipos donde dejó la sesión abierta.
   *
   * Sobre uno mismo no: borrar la propia sesión deja la cookie viva apuntando
   * a nada, y el proxy entra en un ciclo de redirección entre `/` y `/login`.
   * Para salir de este equipo está el botón de cerrar sesión, que sí limpia
   * la cookie.
   */
  async closeSessions(id: string): Promise<number> {
    this.assertNotSelf(id, "cerrar tus propias sesiones desde aquí");

    return this.transaction(async (tx) => {
      const user = await this.findOrThrow(tx, id);
      const closed = await this.closeSessionsWith(tx, id);

      await this.auditWith(tx).record({
        entity: "User",
        entityId: id,
        action: "UPDATE",
        reference: user.email,
        oldValue: { sesiones: closed },
        newValue: { sesiones: 0 },
        sensitivity: "MEDIUM",
      });

      return closed;
    });
  }

  // ── Reglas compartidas ──────────────────────────────────────────────────

  /**
   * Las tres banderas del acceso, siempre juntas.
   *
   * Que un solo lugar las escriba es lo que impide que alguien quede con
   * `active: false` y `banned: false` —sin poder trabajar pero pudiendo
   * iniciar sesión— y que nadie entienda en qué estado está.
   */
  private accessFlags(suspended: boolean, reason?: string) {
    if (suspended) {
      return {
        active: false,
        banned: true,
        banReason: reason ?? null,
        banExpires: null,
      };
    }

    return { active: true, banned: false, banReason: null, banExpires: null };
  }

  private async closeSessionsWith(
    tx: PrismaExecutor,
    userId: string,
  ): Promise<number> {
    const { count } = await tx.session.deleteMany({ where: { userId } });
    return count;
  }

  private async findOrThrow(tx: PrismaExecutor, id: string): Promise<User> {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError("el usuario", id);
    return user;
  }

  /**
   * Nadie se dispara en el pie.
   *
   * Cambiarse el rol, suspenderse, darse de baja o cerrarse la sesión a uno
   * mismo son clics que dejan al administrador fuera del sistema sin forma de
   * volver a entrar. Su nombre, su correo y su contraseña sí los puede
   * cambiar: ninguno de los tres le quita el acceso.
   */
  private assertNotSelf(id: string, accion: string): void {
    if (id === this.context.userId) {
      throw new BusinessRuleError(
        `No puedes ${accion}. Pídeselo a otro administrador.`,
      );
    }
  }

  /** El sistema nunca se queda sin nadie que pueda administrarlo. */
  private async assertNotLastAdmin(
    tx: PrismaExecutor,
    user: User,
    accion: string,
  ): Promise<void> {
    if (toRole(user.role) !== "ADMIN") return;

    const otros = await tx.user.count({
      where: {
        role: "ADMIN",
        active: true,
        banned: false,
        deletedAt: null,
        id: { not: user.id },
      },
    });

    if (otros === 0) {
      throw new BusinessRuleError(
        `${user.name} es el único administrador activo. Al ${accion} nadie podría volver a entrar a esta pantalla. Nombra otro administrador primero.`,
      );
    }
  }

  /**
   * El correo, ya normalizado.
   *
   * El esquema de Zod también lo baja a minúsculas, pero eso sólo protege lo
   * que entra por un formulario: un script que llame al servicio directo se
   * saltaría la validación. Y el índice único de Postgres SÍ distingue
   * mayúsculas, así que "Juan@x.com" y "juan@x.com" convivirían como dos
   * cuentas distintas y la persona no entendería con cuál entra. La regla es
   * del negocio, así que se aplica aquí y no sólo en la capa de arriba.
   */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async assertEmailAvailable(
    tx: PrismaExecutor,
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const otro = await tx.user.findFirst({
      where: {
        // Insensible a mayúsculas: es lo único que detecta al gemelo que ya
        // se hubiera colado escrito de otra forma.
        email: { equals: email, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (!otro) return;

    /* El índice único de Postgres no sabe de bajas lógicas, así que el correo
       de alguien dado de baja sigue ocupado. Sin este mensaje, recontratar a
       la misma persona reventaría con un error de base de datos que nadie
       podría interpretar. */
    if (otro.deletedAt) {
      throw new BusinessRuleError(
        `El correo ${email} lo tiene ${otro.name}, que está dado de baja. Reactívalo desde el filtro "Dados de baja" para que conserve su historial, en vez de crear una cuenta nueva.`,
        "email",
      );
    }

    throw new DuplicateError("un usuario", "correo", email, "email");
  }

  /**
   * La contraseña se cifra con la MISMA función que usa BetterAuth al iniciar
   * sesión. Tomarla de su contexto en vez de reimplementarla es lo que
   * garantiza que lo que se guarda aquí sea lo que allá se verifica.
   */
  private async hashPassword(plain: string): Promise<string> {
    const { password } = await auth.$context;
    return password.hash(plain);
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: toRole(user.role),
      active: user.active,
      banned: user.banned,
      banReason: user.banReason,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
    };
  }
}
