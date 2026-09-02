import { z } from "zod";
import { CutVersion, DocumentType, Unit } from "@prisma/client";
import { cuidSchema, optionalCuid, optionalText, positiveQuantity, requiredText, localDate } from "./common";

export const documentLineSchema = z.object({
  lotId: cuidSchema,
  quantity: positiveQuantity,
  unit: z.nativeEnum(Unit),
  fromLocationId: optionalCuid,
  toLocationId: optionalCuid,
  notes: optionalText,
});

export type DocumentLineInput = z.infer<typeof documentLineSchema>;

/**
 * Un renglón de la tabla de corte: cuántas prendas de una talla salen.
 *
 * Es OTRA cosa que `documentLineSchema`, que habla de rollos y metros. Aquí
 * se cuentan prendas y bultos, que es lo que firma el taller.
 */
export const documentCutLineSchema = z.object({
  sizeId: cuidSchema,
  quantity: z.coerce
    .number({ message: "Escribe cuántas prendas" })
    .int("Las prendas se cuentan enteras")
    .positive("Deben ser más de cero"),
  /// Al menos un bulto: un renglón sin bulto no existe físicamente.
  bundles: z.coerce
    .number({ message: "Escribe cuántos bultos" })
    .int("Los bultos se cuentan enteros")
    .positive("Debe ser al menos un bulto")
    .default(1),
  /** Id del foleo del catálogo. Vacío = sin foleo. */
  tagId: optionalCuid,
  notes: optionalText,
});

export type DocumentCutLineInput = z.infer<typeof documentCutLineSchema>;

/**
 * El encabezado del desglose de corte.
 *
 * Todo opcional: es una hoja que a veces se llena entera y a veces sólo con la
 * descripción. Exigir campos aquí frenaría la salida de puros rollos, que ni
 * siquiera tiene desglose.
 *
 * NO trae fecha ni número de orden propios: la `date` y la `reference` del
 * vale ya cubren el desglose completo —una salida engloba todas sus tallas— y
 * duplicarlos sólo abre la puerta a que se contradigan.
 */
export const cutHeaderSchema = z.object({
  /** Qué se corta: "Blusa manga larga". */
  cutDescription: optionalText,
  /** La tela del catálogo, cuando está dada de alta. */
  cutFabricId: optionalCuid,
  /** La tela escrita a mano, para lo que no existe como material. */
  cutFabricText: optionalText,
  cutPattern: optionalText,
  cutVersion: z
    .union([z.nativeEnum(CutVersion), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  cutVersionNotes: optionalText,
  /**
   * Las notas del pie, numeradas en la hoja ("va sin serigrafiar").
   *
   * Se limpian aquí y no en el componente: un renglón que quedó en blanco
   * porque alguien lo agregó y no lo llenó saldría impreso como "Nota 3." sin
   * texto, y en el taller eso se lee como una instrucción que falta.
   */
  cutNotes: z
    .array(z.string())
    .optional()
    .transform((values) =>
      (values ?? []).map((note) => note.trim()).filter((note) => note.length > 0),
    ),
});

export const documentSchema = z.object({
  type: z.nativeEnum(DocumentType, { message: "Elige el tipo de documento" }),
  date: localDate.optional(),
  clientId: optionalCuid,
  productionRunId: optionalCuid,
  /**
   * De qué orden de corte —y de qué corte suyo— nace el vale.
   *
   * No los teclea nadie: los pone `CuttingOrderService.sendToIssue`. Viven en
   * el esquema porque es la única puerta a crear un documento, y son lo que
   * después deja a la ficha de la orden contestar "esto ya salió y el vale
   * sigue en pie".
   */
  cuttingOrderId: optionalCuid,
  cuttingBatchId: optionalCuid,
  concept: optionalText,
  reference: optionalText,
  /** Quién entrega y quién recibe: el vale se firma en físico. */
  handedOverBy: optionalText,
  receivedBy: optionalText,
  notes: optionalText,
  lines: z.array(documentLineSchema),
  /**
   * La tabla de corte es OPCIONAL: una salida de insumos —cierres, hilo— no
   * corta prendas y no tiene por qué llenarla. Sólo las salidas de tela hacia
   * el taller la traen.
   */
  cutLines: z.array(documentCutLineSchema).optional(),
  ...cutHeaderSchema.shape,
}).superRefine((input, ctx) => {
  /* Una SALIDA puede llevar sólo el desglose de cortes: a veces lo que se
     manda al taller son prendas ya cortadas y no hay tela que descontar. Los
     demás tipos —recepciones, ajustes, traspasos— existen precisamente para
     mover rollos, así que sin renglones no significan nada. */
  if (input.lines.length > 0) return;

  const isIssueWithCuts =
    input.type === "ISSUE" && (input.cutLines?.length ?? 0) > 0;

  if (isIssueWithCuts) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["lines"],
    message:
      input.type === "ISSUE"
        ? "Agrega al menos un rollo o un renglón de corte."
        : "Agrega al menos un renglón.",
  });
});

export type DocumentInput = z.infer<typeof documentSchema>;

/** Cancelar SIEMPRE exige motivo: genera movimientos inversos y se audita CRITICAL. */
export const cancelDocumentSchema = z.object({
  id: cuidSchema,
  reason: requiredText("El motivo", 500),
});
