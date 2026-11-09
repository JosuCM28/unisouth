import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { SitexBoard } from "@/components/workshop-boards/sitex-board";

export const metadata: Metadata = { title: "Tablero Sitex" };

export default async function SitexBoardPage() {
  await requirePermission("workshop-board:sitex");
  return <SitexBoard />;
}
