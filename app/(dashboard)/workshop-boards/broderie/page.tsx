import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { BroderieBoard } from "@/components/workshop-boards/broderie-board";

export const metadata: Metadata = { title: "Tablero Broderie" };

export default async function BroderieBoardPage() {
  await requirePermission("workshop-board:broderie");
  return <BroderieBoard />;
}
