import type { Client } from "@prisma/client";
import { BusinessRuleError, DuplicateError } from "@/lib/core/errors";
import { ClientRepository } from "@/lib/repositories/client.repository";
import type { ClientInput } from "@/lib/validations/client.schema";
import { BaseService } from "./base.service";

export class ClientService extends BaseService {
  async create(input: ClientInput): Promise<Client> {
    return this.transaction(async (tx) => {
      const repository = new ClientRepository(tx);

      // El nombre es la clave natural: es como se le dice en la bodega.
      if (await repository.exists({ name: input.name })) {
        throw new DuplicateError("el cliente", "nombre", input.name, "name");
      }

      const client = await repository.create(input);

      await this.auditWith(tx).record({
        entity: "Client",
        entityId: client.id,
        action: "CREATE",
        reference: client.name,
        newValue: client,
        sensitivity: "LOW",
      });

      return client;
    });
  }

  async update(id: string, input: ClientInput): Promise<Client> {
    return this.transaction(async (tx) => {
      const repository = new ClientRepository(tx);
      const before = await repository.findByIdOrThrow(id);

      if (await repository.exists({ name: input.name }, id)) {
        throw new DuplicateError("el cliente", "nombre", input.name, "name");
      }

      const client = await repository.update(id, input);

      await this.auditWith(tx).record({
        entity: "Client",
        entityId: client.id,
        action: "UPDATE",
        reference: client.name,
        oldValue: before,
        newValue: client,
        sensitivity: "MEDIUM",
      });

      return client;
    });
  }

  /**
   * Baja lógica.
   *
   * Se niega si todavía tiene rollos suyos en bodega: el material es del
   * cliente, y perder de vista a su dueño rompe la segregación por
   * propietario, que es la regla más cara de violar del sistema.
   */
  async remove(id: string, reason?: string): Promise<Client> {
    return this.transaction(async (tx) => {
      const repository = new ClientRepository(tx);
      const before = await repository.findByIdOrThrow(id);

      const lotCount = await repository.countLots(id);
      if (lotCount > 0) {
        throw new BusinessRuleError(
          `${before.name} todavía tiene ${lotCount} ${
            lotCount === 1 ? "rollo" : "rollos"
          } en bodega. Dales salida antes de darlo de baja.`,
        );
      }

      const client = await repository.delete(id);

      await this.auditWith(tx).record({
        entity: "Client",
        entityId: id,
        action: "DELETE",
        reference: before.name,
        oldValue: before,
        newValue: client,
        sensitivity: "HIGH",
        reason,
      });

      return client;
    });
  }
}
