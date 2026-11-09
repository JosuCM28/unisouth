import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { AcatlanBoard } from "@/components/workshop-boards/acatlan-board";

export const metadata: Metadata = { title: "Tablero Acatlán" };

export default async function AcatlanBoardPage() {
  await requirePermission("workshop-board:acatlan");
  return <AcatlanBoard />;
}
