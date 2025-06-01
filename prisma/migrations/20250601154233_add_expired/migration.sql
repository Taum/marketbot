-- AlterTable
ALTER TABLE "UniqueInfo" ADD COLUMN     "seenInLastGeneration" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UniqueInfo_seenInLastGeneration_idx" ON "UniqueInfo"("seenInLastGeneration");

-- AddForeignKey
ALTER TABLE "UniqueInfo" ADD CONSTRAINT "UniqueInfo_cardFamilyId_faction_fkey" FOREIGN KEY ("cardFamilyId", "faction") REFERENCES "CardFamilyStats"("cardFamilyId", "faction") ON DELETE SET NULL ON UPDATE CASCADE;
