/*
  Warnings:

  - A unique constraint covering the columns `[uniqueInfoId,lineNumber]` on the table `MainUniqueAbility` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[textEn]` on the table `MainUniqueAbilityPart` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lineNumber` to the `MainUniqueAbility` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MainUniqueAbility" ADD COLUMN     "lineNumber" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "MainUniqueAbility_uniqueInfoId_lineNumber_idx" ON "MainUniqueAbility"("uniqueInfoId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MainUniqueAbility_uniqueInfoId_lineNumber_key" ON "MainUniqueAbility"("uniqueInfoId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MainUniqueAbilityPart_textEn_key" ON "MainUniqueAbilityPart"("textEn");
