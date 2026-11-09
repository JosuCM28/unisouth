import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { parseWorkshopBoardTab } from "@/lib/constants/workshop-access";
import { BroderieBoard } from "@/components/workshop-boards/broderie-board";

export const metadata: Metadata = { title: "Tablero Broderie" };

interface PageProps {
  searchParams: Promise<{ pestana?: string }>;
}

export default async function BroderieBoardPage({ searchParams }: PageProps) {
  const user = await requirePermission("workshop-board:broderie");
  const { pestana } = await searchParams;

  return (
    <BroderieBoard
      viewerRole={user.role}
      tab={parseWorkshopBoardTab(pestana)}
    />
  );
}
