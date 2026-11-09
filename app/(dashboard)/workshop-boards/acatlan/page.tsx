import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { parseWorkshopBoardTab } from "@/lib/constants/workshop-access";
import { AcatlanBoard } from "@/components/workshop-boards/acatlan-board";

export const metadata: Metadata = { title: "Tablero Acatlán" };

interface PageProps {
  searchParams: Promise<{ pestana?: string }>;
}

export default async function AcatlanBoardPage({ searchParams }: PageProps) {
  const user = await requirePermission("workshop-board:acatlan");
  const { pestana } = await searchParams;

  return (
    <AcatlanBoard
      viewerRole={user.role}
      tab={parseWorkshopBoardTab(pestana)}
    />
  );
}
