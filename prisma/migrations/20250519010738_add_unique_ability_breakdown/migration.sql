/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `UniqueInfo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cardFamilyId` to the `CardFamilyStats` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GenericTriggerType" AS ENUM ('FromHand', 'FromReserve', 'FromAnwhere');

-- CreateEnum
CREATE TYPE "AbilityPart" AS ENUM ('Trigger', 'Condition', 'Effect');

-- AlterTable
ALTER TABLE "CardFamilyStats" ADD COLUMN     "cardFamilyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UniqueInfo" ADD COLUMN     "cardFamilyId" TEXT;

-- CreateTable
CREATE TABLE "MainUniqueAbility" (
    "id" SERIAL NOT NULL,
    "uniqueInfoId" INTEGER NOT NULL,
    "textEn" TEXT NOT NULL,
    "genericTrigger" "GenericTriggerType",
    "triggerId" INTEGER,
    "conditionId" INTEGER,
    "effectId" INTEGER,

    CONSTRAINT "MainUniqueAbility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MainUniqueAbilityPart" (
    "id" SERIAL NOT NULL,
    "textEn" TEXT NOT NULL,

    CONSTRAINT "MainUniqueAbilityPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MainUniqueAbility_id_idx" ON "MainUniqueAbility"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MainUniqueAbility_id_key" ON "MainUniqueAbility"("id");

-- CreateIndex
CREATE INDEX "MainUniqueAbilityPart_id_idx" ON "MainUniqueAbilityPart"("id");

-- CreateIndex
CREATE INDEX "MainUniqueAbilityPart_textEn_idx" ON "MainUniqueAbilityPart"("textEn");

-- CreateIndex
CREATE UNIQUE INDEX "MainUniqueAbilityPart_id_key" ON "MainUniqueAbilityPart"("id");

-- CreateIndex
CREATE INDEX "UniqueInfo_id_idx" ON "UniqueInfo"("id");

-- CreateIndex
CREATE INDEX "UniqueInfo_cardFamilyId_idx" ON "UniqueInfo"("cardFamilyId");

-- CreateIndex
CREATE INDEX "UniqueInfo_lastSeenInSaleAt_idx" ON "UniqueInfo"("lastSeenInSaleAt");

-- CreateIndex
CREATE INDEX "UniqueInfo_nameEn_idx" ON "UniqueInfo"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueInfo_id_key" ON "UniqueInfo"("id");

-- AddForeignKey
ALTER TABLE "MainUniqueAbility" ADD CONSTRAINT "MainUniqueAbility_uniqueInfoId_fkey" FOREIGN KEY ("uniqueInfoId") REFERENCES "UniqueInfo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MainUniqueAbility" ADD CONSTRAINT "MainUniqueAbility_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "MainUniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MainUniqueAbility" ADD CONSTRAINT "MainUniqueAbility_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "MainUniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MainUniqueAbility" ADD CONSTRAINT "MainUniqueAbility_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "MainUniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
