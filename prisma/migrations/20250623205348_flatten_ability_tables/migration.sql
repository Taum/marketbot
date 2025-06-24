-- DropForeignKey
ALTER TABLE "AbilityPartLink" DROP CONSTRAINT "AbilityPartLink_abilityId_fkey";

-- DropForeignKey
ALTER TABLE "AbilityPartLink" DROP CONSTRAINT "AbilityPartLink_partId_fkey";

-- AlterTable
ALTER TABLE "UniqueAbilityLine" ADD COLUMN     "allPartIds" INTEGER[],
ADD COLUMN     "conditionPartId" INTEGER,
ADD COLUMN     "effectPartId" INTEGER,
ADD COLUMN     "extraEffectPartIds" INTEGER[],
ADD COLUMN     "triggerPartId" INTEGER;

-- AddForeignKey
ALTER TABLE "UniqueAbilityLine" ADD CONSTRAINT "UniqueAbilityLine_triggerPartId_fkey" FOREIGN KEY ("triggerPartId") REFERENCES "UniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniqueAbilityLine" ADD CONSTRAINT "UniqueAbilityLine_conditionPartId_fkey" FOREIGN KEY ("conditionPartId") REFERENCES "UniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniqueAbilityLine" ADD CONSTRAINT "UniqueAbilityLine_effectPartId_fkey" FOREIGN KEY ("effectPartId") REFERENCES "UniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "UniqueAbilityLine" SET "triggerPartId" = (SELECT "partId" FROM "AbilityPartLink" WHERE "abilityId" = "UniqueAbilityLine"."id" AND "partType" = 'Trigger');
UPDATE "UniqueAbilityLine" SET "conditionPartId" = (SELECT "partId" FROM "AbilityPartLink" WHERE "abilityId" = "UniqueAbilityLine"."id" AND "partType" = 'Condition');
UPDATE "UniqueAbilityLine" SET "effectPartId" = (SELECT "partId" FROM "AbilityPartLink" WHERE "abilityId" = "UniqueAbilityLine"."id" AND "partType" = 'Effect');
UPDATE "UniqueAbilityLine" SET "extraEffectPartIds" = (SELECT ARRAY_AGG("partId") FROM "AbilityPartLink" WHERE "abilityId" = "UniqueAbilityLine"."id" AND "partType" = 'ExtraEffect');
UPDATE "UniqueAbilityLine" SET "allPartIds" = (SELECT ARRAY_AGG("partId") FROM "AbilityPartLink" WHERE "abilityId" = "UniqueAbilityLine"."id");

-- DropTable
DROP TABLE "AbilityPartLink";

-- CreateIndex
CREATE INDEX "UniqueAbilityLine_isSupport_idx" ON "UniqueAbilityLine"("isSupport");

-- CreateIndex
CREATE INDEX "UniqueAbilityLine_triggerPartId_idx" ON "UniqueAbilityLine"("triggerPartId");

-- CreateIndex
CREATE INDEX "UniqueAbilityLine_conditionPartId_idx" ON "UniqueAbilityLine"("conditionPartId");

-- CreateIndex
CREATE INDEX "UniqueAbilityLine_effectPartId_idx" ON "UniqueAbilityLine"("effectPartId");

