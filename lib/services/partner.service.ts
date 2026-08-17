import type { Carrier, Supplier } from "@prisma/client";
import { BusinessRuleError, DuplicateError, NotFoundError } from "@/lib/core/errors";
import type {
  CarrierInput,
  SupplierInput,
} from "@/lib/validations/partner.schema";
import { BaseService } from "./base.service";

/**
 * Paqueterías: quién trae la carga a la bodega.
 *
 * Catálogo pequeño y estable —tres o cuatro nombres— pero necesario: sin él,
 * la recepción no puede registrar por dónde llegó la mercancía.
 */
export class CarrierService extends BaseService {
  async create(input: CarrierInput): Promise<Carrier> {
    return this.transaction(async (tx) => {
      // El nombre es la clave natural: es como se le dice en el andén.
      const exists = await tx.carrier.findFirst({
        where: { name: input.name, deletedAt: null },
      });
      if (exists) {
        throw new DuplicateError("la paquetería", "nombre", input.name, "name");
      }

      const carrier = await tx.carrier.create({ data: input });

      await this.auditWith(tx).record({
        entity: "Carrier",
        entityId: carrier.id,
        action: "CREATE",
        reference: carrier.name,
        newValue: carrier,
        sensitivity: "LOW",
      });

      return carrier;
    });
  }

  async update(id: string, input: CarrierInput): Promise<Carrier> {
    return this.transaction(async (tx) => {
      const before = await tx.carrier.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("la paquetería", id);

      const duplicate = await tx.carrier.findFirst({
        where: { name: input.name, deletedAt: null, id: { not: id } },
      });
      if (duplicate) {
        throw new DuplicateError("la paquetería", "nombre", input.name, "name");
      }

      const carrier = await tx.carrier.update({ where: { id }, data: input });

      await this.auditWith(tx).record({
        entity: "Carrier",
        entityId: id,
        action: "UPDATE",
        reference: carrier.name,
        oldValue: before,
        newValue: carrier,
        sensitivity: "MEDIUM",
      });

      return carrier;
    });
  }

  /**
   * Baja lógica.
   *
   * Se niega si ya trajo mercancía: las recepciones viejas deben poder seguir
   * mostrando por dónde llegó la carga.
   */
  async remove(id: string, reason?: string): Promise<Carrier> {
    return this.transaction(async (tx) => {
      const before = await tx.carrier.findUnique({
        where: { id },
        include: { _count: { select: { receipts: true } } },
      });
      if (!before) throw new NotFoundError("la paquetería", id);

      if (before._count.receipts > 0) {
        throw new BusinessRuleError(
          `${before.name} tiene ${before._count.receipts} ${
            before._count.receipts === 1
              ? "recepción registrada"
              : "recepciones registradas"
          }. Desactívala en vez de borrarla.`,
        );
      }

      const carrier = await tx.carrier.update({
        where: { id },
        data: { deletedAt: new Date(), active: false },
      });

      await this.auditWith(tx).record({
        entity: "Carrier",
        entityId: id,
        action: "DELETE",
        reference: before.name,
        oldValue: before,
        newValue: carrier,
        sensitivity: "HIGH",
        reason,
      });

      return carrier;
    });
  }
}

/** Proveedores: a quién se le compra el material. */
export class SupplierService extends BaseService {
  async create(input: SupplierInput): Promise<Supplier> {
    return this.transaction(async (tx) => {
      const exists = await tx.supplier.findFirst({
        where: { name: input.name, deletedAt: null },
      });
      if (exists) {
        throw new DuplicateError("el proveedor", "nombre", input.name, "name");
      }

      const supplier = await tx.supplier.create({ data: input });

      await this.auditWith(tx).record({
        entity: "Supplier",
        entityId: supplier.id,
        action: "CREATE",
        reference: supplier.name,
        newValue: supplier,
        sensitivity: "LOW",
      });

      return supplier;
    });
  }

  async update(id: string, input: SupplierInput): Promise<Supplier> {
    return this.transaction(async (tx) => {
      const before = await tx.supplier.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("el proveedor", id);

      const duplicate = await tx.supplier.findFirst({
        where: { name: input.name, deletedAt: null, id: { not: id } },
      });
      if (duplicate) {
        throw new DuplicateError("el proveedor", "nombre", input.name, "name");
      }

      const supplier = await tx.supplier.update({ where: { id }, data: input });

      await this.auditWith(tx).record({
        entity: "Supplier",
        entityId: id,
        action: "UPDATE",
        reference: supplier.name,
        oldValue: before,
        newValue: supplier,
        sensitivity: "MEDIUM",
      });

      return supplier;
    });
  }

  async remove(id: string, reason?: string): Promise<Supplier> {
    return this.transaction(async (tx) => {
      const before = await tx.supplier.findUnique({
        where: { id },
        include: {
          _count: { select: { receipts: true, purchaseRequests: true } },
        },
      });
      if (!before) throw new NotFoundError("el proveedor", id);

      const usos = before._count.receipts + before._count.purchaseRequests;
      if (usos > 0) {
        throw new BusinessRuleError(
          `${before.name} aparece en ${usos} ${
            usos === 1 ? "registro" : "registros"
          } entre recepciones y requisiciones. Desactívalo en vez de borrarlo.`,
        );
      }

      const supplier = await tx.supplier.update({
        where: { id },
        data: { deletedAt: new Date(), active: false },
      });

      await this.auditWith(tx).record({
        entity: "Supplier",
        entityId: id,
        action: "DELETE",
        reference: before.name,
        oldValue: before,
        newValue: supplier,
        sensitivity: "HIGH",
        reason,
      });

      return supplier;
    });
  }
}
