import type { Location } from "@prisma/client";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import { LocationRepository } from "@/lib/repositories/location.repository";
import type { LocationInput } from "@/lib/validations/location.schema";
import { BaseService } from "./base.service";

/**
 * Reglas de las ubicaciones de bodega.
 *
 * Poca cosa comparado con inventario, pero la baja sí tiene una regla que
 * importa: una ubicación con rollos encima no puede desaparecer.
 */
export class LocationService extends BaseService {
  private get repository(): LocationRepository {
    return new LocationRepository(this.db);
  }

  async create(input: LocationInput): Promise<Location> {
    return this.transaction(async (tx) => {
      const repository = new LocationRepository(tx);

      // El código es la clave natural: es lo que está pintado en el piso.
      if (await repository.exists({ code: input.code })) {
        throw new DuplicateError("la ubicación", "código", input.code, "code");
      }

      const location = await repository.create({
        code: input.code,
        name: input.name,
        type: input.type,
        order: input.order ?? 0,
        lotCapacity: input.lotCapacity,
        notes: input.notes,
        active: input.active,
        ...(input.parentId ? { parent: { connect: { id: input.parentId } } } : {}),
      });

      await this.auditWith(tx).record({
        entity: "Location",
        entityId: location.id,
        action: "CREATE",
        reference: location.code,
        newValue: location,
        sensitivity: "LOW",
      });

      return location;
    });
  }

  async update(id: string, input: LocationInput): Promise<Location> {
    return this.transaction(async (tx) => {
      const repository = new LocationRepository(tx);
      const before = await repository.findByIdOrThrow(id);

      if (await repository.exists({ code: input.code }, id)) {
        throw new DuplicateError("la ubicación", "código", input.code, "code");
      }

      const location = await repository.update(id, {
        code: input.code,
        name: input.name,
        type: input.type,
        order: input.order ?? 0,
        lotCapacity: input.lotCapacity,
        notes: input.notes,
        active: input.active,
        parent: input.parentId
          ? { connect: { id: input.parentId } }
          : { disconnect: true },
      });

      await this.auditWith(tx).record({
        entity: "Location",
        entityId: location.id,
        action: "UPDATE",
        reference: location.code,
        oldValue: before,
        newValue: location,
        sensitivity: "MEDIUM",
      });

      return location;
    });
  }

  /**
   * Baja lógica de la ubicación.
   *
   * Se niega si todavía tiene rollos encima: darla de baja los dejaría
   * apuntando a un lugar que ya no existe en los listados, y en la bodega
   * física seguirían ahí, invisibles para el sistema.
   */
  async remove(id: string, reason?: string): Promise<Location> {
    return this.transaction(async (tx) => {
      const repository = new LocationRepository(tx);
      const before = await repository.findByIdOrThrow(id);

      const lotCount = await repository.countLots(id);
      if (lotCount > 0) {
        throw new BusinessRuleError(
          `La ubicación ${before.code} todavía tiene ${lotCount} ${
            lotCount === 1 ? "rollo" : "rollos"
          }. Traspásalos a otra ubicación antes de darla de baja.`,
        );
      }

      const location = await repository.delete(id);

      await this.auditWith(tx).record({
        entity: "Location",
        entityId: id,
        action: "DELETE",
        reference: before.code,
        oldValue: before,
        newValue: location,
        sensitivity: "HIGH",
        reason,
      });

      return location;
    });
  }

  /** Lectura simple para las pantallas. */
  async findAllWithLotCount() {
    return this.repository.findAllWithLotCount();
  }
}
