/*
  Warnings:

  - Added the required column `partType` to the `MainUniqueAbilityPart` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AbilityPartType" AS ENUM ('Trigger', 'TriggerCondition', 'Condition', 'Effect');

-- AlterTable
ALTER TABLE "MainUniqueAbility" ADD COLUMN     "triggerConditionId" INTEGER;

-- AlterTable
ALTER TABLE "MainUniqueAbilityPart" ADD COLUMN     "partType" "AbilityPartType" NOT NULL;

-- DropEnum
DROP TYPE "AbilityPart";

-- AddForeignKey
ALTER TABLE "MainUniqueAbility" ADD CONSTRAINT "MainUniqueAbility_triggerConditionId_fkey" FOREIGN KEY ("triggerConditionId") REFERENCES "MainUniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
