import type { Prisma, Setting } from "@prisma/client";
import {
  BaseRepository,
  type PrismaDelegate,
} from "@/lib/core/base-repository";

/**
 * Los ajustes de la app, guardados como llave → JSON.
 *
 * La tabla es genérica a propósito: un interruptor nuevo no debe costar una
 * migración. Qué forma tiene cada valor lo decide el servicio que lo lee;
 * aquí sólo se guarda y se lee tal cual.
 */
export class SettingRepository extends BaseRepository<
  Setting,
  Prisma.SettingCreateInput,
  Prisma.SettingUpdateInput
> {
  // Un ajuste no se da de baja: se sobrescribe.
  protected override readonly usesSoftDelete = false;

  protected get delegate(): PrismaDelegate {
    return this.db.setting;
  }

  protected get entityName(): string {
    return "el ajuste";
  }

  /** El valor crudo de una llave, o null si nunca se ha guardado. */
  async findValue(key: string): Promise<Prisma.JsonValue | null> {
    const setting = await this.db.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  /** Guarda el valor, creando la llave la primera vez. */
  async upsertValue(
    key: string,
    value: Prisma.InputJsonValue,
    meta: { description: string; group: string },
  ): Promise<void> {
    await this.db.setting.upsert({
      where: { key },
      create: { key, value, ...meta },
      update: { value },
    });
  }
}
