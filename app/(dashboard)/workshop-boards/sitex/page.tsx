import type { Metadata } from "next";
import { requirePermission } from "@/lib/core/session";
import { parseWorkshopBoardTab } from "@/lib/constants/workshop-access";
import { SitexBoard } from "@/components/workshop-boards/sitex-board";

export const metadata: Metadata = { title: "Tablero Sitex" };

interface PageProps {
  searchParams: Promise<{ pestana?: string }>;
}

export default async function SitexBoardPage({ searchParams }: PageProps) {
  const user = await requirePermission("workshop-board:sitex");
  const { pestana } = await searchParams;

  return (
    <SitexBoard viewerRole={user.role} tab={parseWorkshopBoardTab(pestana)} />
  );
}
