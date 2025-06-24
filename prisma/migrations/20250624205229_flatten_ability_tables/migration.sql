-- CreateTable
CREATE TABLE "UniqueAbilityLineFlat" (
    "id" SERIAL NOT NULL,
    "uniqueInfoId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "isSupport" BOOLEAN NOT NULL,
    "triggerPartId" INTEGER,
    "conditionPartId" INTEGER,
    "effectPartId" INTEGER,
    "extraEffectPartIds" INTEGER[],
    "allPartIds" INTEGER[],
    "characterData" JSONB,
    "textEn" TEXT NOT NULL,

    CONSTRAINT "UniqueAbilityLineFlat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_id_idx" ON "UniqueAbilityLineFlat"("id");

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_uniqueInfoId_lineNumber_isSupport_idx" ON "UniqueAbilityLineFlat"("uniqueInfoId", "lineNumber", "isSupport");

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_isSupport_idx" ON "UniqueAbilityLineFlat"("isSupport");

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_triggerPartId_idx" ON "UniqueAbilityLineFlat"("triggerPartId");

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_conditionPartId_idx" ON "UniqueAbilityLineFlat"("conditionPartId");

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_effectPartId_idx" ON "UniqueAbilityLineFlat"("effectPartId");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueAbilityLineFlat_id_key" ON "UniqueAbilityLineFlat"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueAbilityLineFlat_uniqueInfoId_lineNumber_isSupport_key" ON "UniqueAbilityLineFlat"("uniqueInfoId", "lineNumber", "isSupport");

-- CreateIndex
CREATE INDEX "UniqueAbilityLine_isSupport_idx" ON "UniqueAbilityLine"("isSupport");

-- AddForeignKey
ALTER TABLE "UniqueAbilityLineFlat" ADD CONSTRAINT "UniqueAbilityLineFlat_uniqueInfoId_fkey" FOREIGN KEY ("uniqueInfoId") REFERENCES "UniqueInfo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniqueAbilityLineFlat" ADD CONSTRAINT "UniqueAbilityLineFlat_triggerPartId_fkey" FOREIGN KEY ("triggerPartId") REFERENCES "UniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniqueAbilityLineFlat" ADD CONSTRAINT "UniqueAbilityLineFlat_conditionPartId_fkey" FOREIGN KEY ("conditionPartId") REFERENCES "UniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniqueAbilityLineFlat" ADD CONSTRAINT "UniqueAbilityLineFlat_effectPartId_fkey" FOREIGN KEY ("effectPartId") REFERENCES "UniqueAbilityPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "UniqueAbilityLineFlat" ("id", "uniqueInfoId", "lineNumber", "isSupport", "characterData", "textEn", "triggerPartId", "conditionPartId", "effectPartId", "extraEffectPartIds", "allPartIds")
(SELECT ual."id" as id, "uniqueInfoId", "lineNumber", "isSupport", "characterData", "textEn",
apl1."partId" as "triggerPartId",
apl2."partId" as "conditionPartId",
apl3."partId" as "effectPartId",
(SELECT array_agg("partId") FROM (SELECT "partId" FROM "AbilityPartLink" as apl4 WHERE apl4."abilityId" = ual.id AND apl4."partType" = 'ExtraEffect')) as "extraEffectPartIds",
array_agg(apl."partId") as "allPartIds" FROM "UniqueAbilityLine" as ual
JOIN "AbilityPartLink" as apl ON apl."abilityId" = ual.id
JOIN "AbilityPartLink" as apl1 ON apl1."abilityId" = ual.id
JOIN "AbilityPartLink" as apl2 ON apl2."abilityId" = ual.id
JOIN "AbilityPartLink" as apl3 ON apl3."abilityId" = ual.id
WHERE apl1."partType" = 'Trigger' AND apl2."partType" = 'Condition' AND apl3."partType" = 'Effect'
GROUP BY ual.id, apl1."partId", apl2."partId", apl3."partId")
