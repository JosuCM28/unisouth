import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { parseWorkshopBoardTab } from "@/lib/constants/workshop-access";
import { AllendeBoard } from "@/components/workshop-boards/allende-board";

export const metadata: Metadata = { title: "Tablero Allende" };

interface PageProps {
  searchParams: Promise<{ pestana?: string }>;
}

export default async function AllendeBoardPage({ searchParams }: PageProps) {
  const user = await requirePermission("workshop-board:allende");
  const { pestana } = await searchParams;

  return (
    <AllendeBoard
      viewerRole={user.role}
      tab={parseWorkshopBoardTab(pestana)}
    />
  );
}
