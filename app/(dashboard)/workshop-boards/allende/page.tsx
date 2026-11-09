import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { AllendeBoard } from "@/components/workshop-boards/allende-board";

export const metadata: Metadata = { title: "Tablero Allende" };

export default async function AllendeBoardPage() {
  await requirePermission("workshop-board:allende");
  return <AllendeBoard />;
}
