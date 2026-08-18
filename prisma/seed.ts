import { PrismaClient, LocationType, MaterialType, Unit } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Datos mínimos para que el sistema arranque.
 *
 * Todo va con upsert y llave natural (code/key/name), así que correr el seed
 * dos veces no duplica nada ni pisa lo que el usuario haya editado a mano en
 * los campos que aquí no tocamos.
 */

/** Las tallas escalan el consumo en vez de duplicar la ficha técnica. */
const SIZES = [
  { code: "CH", name: "Chica", order: 1, consumptionFactor: "0.92", group: "letra" },
  { code: "M", name: "Mediana", order: 2, consumptionFactor: "1.00", group: "letra" },
  { code: "G", name: "Grande", order: 3, consumptionFactor: "1.08", group: "letra" },
  { code: "XG", name: "Extra grande", order: 4, consumptionFactor: "1.16", group: "letra" },
  { code: "2XG", name: "Doble extra grande", order: 5, consumptionFactor: "1.24", group: "letra" },

  /**
   * Tallas numéricas de pantalón y blusa industrial (26 a 50).
   *
   * Conviven con las de letra en vez de sustituirlas: una misma bodega surte
   * overoles por talla numérica y playeras por CH/M/G. El `group` las separa
   * para que un desplegable no mezcle las dos escalas.
   *
   * El factor de consumo escala desde la 34, que es la talla media de la
   * escala: cada dos números suma ~4% de tela, la misma progresión que ya
   * usan las de letra.
   */
  ...NUMERIC_SIZES(),
] as const;

/** Genera 26, 28, 30 … 50 con su factor de consumo escalado desde la 34. */
function NUMERIC_SIZES() {
  const BASE = 34;
  const STEP_PCT = 0.04;

  return Array.from({ length: 13 }, (_, index) => {
    const number = 26 + index * 2;
    const factor = 1 + ((number - BASE) / 2) * STEP_PCT;

    return {
      code: String(number),
      name: `Talla ${number}`,
      // Después de las de letra, en el orden natural de la escala.
      order: 100 + index,
      consumptionFactor: factor.toFixed(4),
      group: "numerica",
    };
  });
}

/**
 * Almacenes.
 *
 * El principal nace como `isDefault`: los rollos que se dan de alta sin
 * especificar almacén caen ahí, para que el auxiliar no tenga que elegir en
 * el andén con la carga esperando.
 */
const WAREHOUSES = [
  {
    code: "PRINCIPAL",
    name: "Almacén principal",
    isDefault: true,
    locations: [
      { code: "F1", name: "Fila 1", type: LocationType.ROW, order: 1 },
      { code: "F2", name: "Fila 2", type: LocationType.ROW, order: 2 },
      { code: "F3", name: "Fila 3", type: LocationType.ROW, order: 3 },
      { code: "F4", name: "Fila 4", type: LocationType.ROW, order: 4 },
      {
        code: "RETAZOS",
        name: "Retazos",
        type: LocationType.REMNANTS,
        order: 99,
      },
    ],
  },
] as const;

/** Series de folios de la sección 13 del contrato. */
const SEQUENCES = [
  { key: "LOT", prefix: "R", padding: 5 },
  { key: "RECEIPT", prefix: "REC", padding: 4 },
  { key: "INBOUND", prefix: "IN", padding: 4 },
  { key: "OUTBOUND", prefix: "OUT", padding: 4 },
  { key: "MOVEMENT", prefix: "MOV", padding: 7 },
  { key: "CALCULATION", prefix: "CALC", padding: 4 },
  { key: "PRODUCTION_ORDER", prefix: "PO", padding: 4 },
  { key: "PURCHASE_REQUEST", prefix: "PR", padding: 4 },
] as const;

const SETTINGS = [
  {
    key: "company.name",
    value: "UNISOUTH",
    description: "Nombre que aparece en encabezados y documentos impresos",
    group: "empresa",
  },
  {
    key: "inventory.globalWastePct",
    value: 3,
    description:
      "Merma global por omisión (%). Se compone con la merma de línea, no se suma.",
    group: "inventario",
  },
  {
    key: "inventory.safetyMarginPct",
    value: 5,
    description: "Margen de seguridad por omisión (%) en el motor de cálculo",
    group: "inventario",
  },
  {
    key: "inventory.respectOwnership",
    value: true,
    description:
      "Jamás surtir material de un cliente a la producción de otro. Cambiar sólo con autorización de dirección.",
    group: "inventario",
  },
] as const;

async function seedSizes() {
  for (const size of SIZES) {
    await prisma.size.upsert({
      where: { code: size.code },
      update: {
        name: size.name,
        order: size.order,
        consumptionFactor: size.consumptionFactor,
        group: size.group,
      },
      create: {
        code: size.code,
        name: size.name,
        order: size.order,
        consumptionFactor: size.consumptionFactor,
        group: size.group,
      },
    });
  }
  console.log(`  ✓ ${SIZES.length} tallas`);
}

async function seedWarehouses() {
  let locationCount = 0;

  for (const warehouse of WAREHOUSES) {
    const saved = await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: { name: warehouse.name, isDefault: warehouse.isDefault },
      create: {
        code: warehouse.code,
        name: warehouse.name,
        isDefault: warehouse.isDefault,
      },
    });

    for (const location of warehouse.locations) {
      // La clave natural es el par almacén+código: dos almacenes pueden tener
      // cada uno su "F1" sin pisarse.
      await prisma.location.upsert({
        where: {
          warehouseId_code: { warehouseId: saved.id, code: location.code },
        },
        update: {
          name: location.name,
          type: location.type,
          order: location.order,
        },
        create: {
          warehouseId: saved.id,
          code: location.code,
          name: location.name,
          type: location.type,
          order: location.order,
        },
      });
      locationCount += 1;
    }
  }

  console.log(`  ✓ ${WAREHOUSES.length} almacén(es), ${locationCount} ubicaciones`);
}

async function seedClients() {
  await prisma.client.upsert({
    where: { name: "Ternium" },
    update: {},
    create: {
      code: "TERNIUM",
      name: "Ternium",
      legalName: "Ternium México, S.A. de C.V.",
      notes: "Cliente de ejemplo. La tela que manda es suya, no de la fábrica.",
    },
  });
  console.log("  ✓ 1 cliente");
}

async function seedMaterials() {
  // Mezclilla: se especifica en onzas (oz/yd²), no en milímetros.
  await prisma.material.upsert({
    where: { code: "TELA-MEZ-12" },
    update: {},
    create: {
      code: "TELA-MEZ-12",
      name: "Mezclilla 12 oz",
      type: MaterialType.FABRIC,
      baseUnit: Unit.METER,
      composition: "100% algodón",
      colorName: "Índigo",
      weightOz: "12",
      widthMm: 1500,
      // Abajo de 5 m el rollo ya es retazo y se ofrece primero al surtir.
      remnantThreshold: "5",
      // El tono de tintura varía entre partidas: mezclar dos en un mismo
      // tendido saca la prenda con franjas y se rechaza.
      requiresShade: true,
      lotControlled: true,
    },
  });

  // Los cierres se cuentan por pieza y no tienen tono ni retazo.
  await prisma.material.upsert({
    where: { code: "CIE-MET-18" },
    update: {},
    create: {
      code: "CIE-MET-18",
      name: 'Cierre metálico 18"',
      type: MaterialType.ZIPPER,
      baseUnit: Unit.PIECE,
      colorName: "Latón",
      lotControlled: false,
    },
  });

  console.log("  ✓ 2 materiales");
}

async function seedSequences() {
  const year = new Date().getFullYear();

  for (const sequence of SEQUENCES) {
    await prisma.sequence.upsert({
      where: { key: sequence.key },
      // No se toca `next`: reiniciar un contador duplicaría folios ya emitidos.
      update: {},
      create: {
        key: sequence.key,
        prefix: `${sequence.prefix}-${year}`,
        next: 1,
        padding: sequence.padding,
      },
    });
  }
  console.log(`  ✓ ${SEQUENCES.length} secuencias`);
}

async function seedSettings() {
  for (const setting of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      // Se respeta el valor que dirección haya ajustado en la app.
      update: { description: setting.description, group: setting.group },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        group: setting.group,
      },
    });
  }
  console.log(`  ✓ ${SETTINGS.length} settings`);
}

async function main() {
  console.log("Sembrando datos base…");

  await seedSizes();
  await seedWarehouses();
  await seedClients();
  await seedMaterials();
  await seedSequences();
  await seedSettings();

  console.log("Listo.");
}

main()
  .catch((error) => {
    console.error("El seed falló:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
