/*
  Warnings:

  - A unique constraint covering the columns `[cardFamilyId,faction]` on the table `CardFamilyStats` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fetchCompletedGeneration` to the `CardFamilyStats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fetchStartGeneration` to the `CardFamilyStats` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CardFamilyStats_name_faction_idx";

-- AlterTable
ALTER TABLE "CardFamilyStats" ADD COLUMN     "fetchCompletedAt" TIMESTAMP(3),
ADD COLUMN     "fetchCompletedGeneration" INTEGER NOT NULL,
ADD COLUMN     "fetchStartGeneration" INTEGER NOT NULL,
ADD COLUMN     "fetchStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CardFamilyStats_cardFamilyId_faction_idx" ON "CardFamilyStats"("cardFamilyId", "faction");

-- CreateIndex
CREATE UNIQUE INDEX "CardFamilyStats_cardFamilyId_faction_key" ON "CardFamilyStats"("cardFamilyId", "faction");
