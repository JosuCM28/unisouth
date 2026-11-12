import type { ProcessStage } from "@prisma/client";
import type { ProcessStageInput } from "@/lib/validations/garment-shipment.schema";
import { BaseService } from "./base.service";

/**
 * Catálogo de etapas del proceso (corte, costura, bordado…).
 *
 * Es un catálogo plano sin reglas, pero vive en un servicio como todos: la
 * action no habla con Prisma, y así el día que una etapa necesite una regla
 * —no darla de baja si un envío la usa— hay un lugar donde ponerla.
 */
export class ProcessStageService extends BaseService {
  async create(input: ProcessStageInput): Promise<ProcessStage> {
    return this.db.processStage.create({ data: input });
  }

  async update(id: string, input: ProcessStageInput): Promise<ProcessStage> {
    return this.db.processStage.update({ where: { id }, data: input });
  }

  /** Baja lógica: los envíos viejos siguen diciendo en qué etapa iban. */
  async remove(id: string): Promise<ProcessStage> {
    return this.db.processStage.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }
}
