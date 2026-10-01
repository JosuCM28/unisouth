-- CreateTable
CREATE TABLE "global_cut_bundles" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sizeCode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "bundles" INTEGER NOT NULL DEFAULT 1,
    "tagId" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_cut_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "global_cut_bundles_groupId_idx" ON "global_cut_bundles"("groupId");

-- CreateIndex
CREATE INDEX "global_cut_bundles_folderId_idx" ON "global_cut_bundles"("folderId");

-- AddForeignKey
ALTER TABLE "global_cut_bundles" ADD CONSTRAINT "global_cut_bundles_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "order_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

