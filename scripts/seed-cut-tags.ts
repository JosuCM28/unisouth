/**
 * Alta de los foleos y migración de los renglones ya capturados.
 *
 * Es idempotente: se puede correr las veces que haga falta. Los colores que
 * ya existan se actualizan, no se duplican.
 */
import { prisma } from "../lib/prisma";

const TAGS = [
  { code: "BLUE", name: "Azul", color: "#1d4ed8" },
  { code: "GREEN", name: "Verde", color: "#15803d" },
  { code: "ORANGE", name: "Naranja", color: "#ea580c" },
  { code: "YELLOW", name: "Amarillo", color: "#facc15" },
  { code: "RED", name: "Rojo", color: "#b91c1c" },
  { code: "PURPLE", name: "Morado", color: "#7e22ce" },
  { code: "PINK", name: "Rosa", color: "#ec4899" },
  { code: "BROWN", name: "Café", color: "#78350f" },
  { code: "BLACK", name: "Negro", color: "#1c1917" },
  { code: "WHITE", name: "Blanco", color: "#ffffff" },
] as const;

async function main() {
  for (const [index, tag] of TAGS.entries()) {
    await prisma.cutTagOption.upsert({
      where: { code: tag.code },
      update: { name: tag.name, color: tag.color, order: index },
      create: { ...tag, order: index },
    });
  }
  console.log(`  ${TAGS.length} foleos dados de alta`);

  // Los renglones capturados con el enum viejo apuntan ahora al catálogo.
  const pending = await prisma.documentCutLine.findMany({
    where: { tagId: null, tag: { not: null } },
    select: { id: true, tag: true },
  });

  for (const line of pending) {
    const option = await prisma.cutTagOption.findUnique({
      where: { code: line.tag as string },
      select: { id: true },
    });
    if (option) {
      await prisma.documentCutLine.update({
        where: { id: line.id },
        data: { tagId: option.id },
      });
    }
  }
  console.log(`  ${pending.length} renglones de corte enlazados al catálogo`);
}

main().finally(() => prisma.$disconnect());
