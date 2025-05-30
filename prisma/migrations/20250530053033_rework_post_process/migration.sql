/*
  Warnings:

  - The values [TriggerCondition] on the enum `AbilityPartType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `MainUniqueAbility` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MainUniqueAbilityPart` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum

-- DropForeignKey
ALTER TABLE "MainUniqueAbility" DROP CONSTRAINT "MainUniqueAbility_conditionId_fkey";

-- DropForeignKey
ALTER TABLE "MainUniqueAbility" DROP CONSTRAINT "MainUniqueAbility_effectId_fkey";

-- DropForeignKey
ALTER TABLE "MainUniqueAbility" DROP CONSTRAINT "MainUniqueAbility_triggerConditionId_fkey";

-- DropForeignKey
ALTER TABLE "MainUniqueAbility" DROP CONSTRAINT "MainUniqueAbility_triggerId_fkey";

-- DropForeignKey
ALTER TABLE "MainUniqueAbility" DROP CONSTRAINT "MainUniqueAbility_uniqueInfoId_fkey";

-- DropTable
DROP TABLE "MainUniqueAbility";

-- DropTable
DROP TABLE "MainUniqueAbilityPart";

-- DropEnum
DROP TYPE "GenericTriggerType";

-- DropEnum
DROP TYPE "AbilityPartType";

CREATE TYPE "AbilityPartType" AS ENUM ('Trigger', 'Condition', 'Effect', 'ExtraEffect');


-- CreateTable
CREATE TABLE "UniqueAbilityLine" (
    "id" SERIAL NOT NULL,
    "uniqueInfoId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "isSupport" BOOLEAN NOT NULL,
    "characterData" JSONB,
    "textEn" TEXT NOT NULL,

    CONSTRAINT "UniqueAbilityLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbilityPartLink" (
    "id" SERIAL NOT NULL,
    "partId" INTEGER NOT NULL,
    "abilityId" INTEGER NOT NULL,
    "partType" "AbilityPartType" NOT NULL,

    CONSTRAINT "AbilityPartLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniqueAbilityPart" (
    "id" SERIAL NOT NULL,
    "textEn" TEXT NOT NULL,
    "partType" "AbilityPartType" NOT NULL,
    "isSupport" BOOLEAN NOT NULL,

    CONSTRAINT "UniqueAbilityPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UniqueAbilityLine_id_idx" ON "UniqueAbilityLine"("id");

-- CreateIndex
CREATE INDEX "UniqueAbilityLine_uniqueInfoId_lineNumber_isSupport_idx" ON "UniqueAbilityLine"("uniqueInfoId", "lineNumber", "isSupport");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueAbilityLine_id_key" ON "UniqueAbilityLine"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueAbilityLine_uniqueInfoId_lineNumber_isSupport_key" ON "UniqueAbilityLine"("uniqueInfoId", "lineNumber", "isSupport");

-- CreateIndex
CREATE INDEX "AbilityPartLink_partId_idx" ON "AbilityPartLink"("partId");

-- CreateIndex
CREATE INDEX "AbilityPartLink_abilityId_idx" ON "AbilityPartLink"("abilityId");

-- CreateIndex
CREATE UNIQUE INDEX "AbilityPartLink_id_key" ON "AbilityPartLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AbilityPartLink_partId_abilityId_key" ON "AbilityPartLink"("partId", "abilityId");

-- CreateIndex
CREATE INDEX "UniqueAbilityPart_id_idx" ON "UniqueAbilityPart"("id");

-- CreateIndex
CREATE INDEX "UniqueAbilityPart_textEn_idx" ON "UniqueAbilityPart"("textEn");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueAbilityPart_id_key" ON "UniqueAbilityPart"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueAbilityPart_textEn_partType_isSupport_key" ON "UniqueAbilityPart"("textEn", "partType", "isSupport");

-- AddForeignKey
ALTER TABLE "UniqueAbilityLine" ADD CONSTRAINT "UniqueAbilityLine_uniqueInfoId_fkey" FOREIGN KEY ("uniqueInfoId") REFERENCES "UniqueInfo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilityPartLink" ADD CONSTRAINT "AbilityPartLink_partId_fkey" FOREIGN KEY ("partId") REFERENCES "UniqueAbilityPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilityPartLink" ADD CONSTRAINT "AbilityPartLink_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "UniqueAbilityLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
