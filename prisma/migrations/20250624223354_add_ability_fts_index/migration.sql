-- Full text search indexes
CREATE INDEX "UniqueAbilityLine_fts_idx" ON "UniqueAbilityLine" USING GIN(to_tsvector('simple', COALESCE("textEn", '')));

CREATE INDEX "UniqueAbilityLineFlat_fts_idx" ON "UniqueAbilityLineFlat" USING GIN(to_tsvector('simple', COALESCE("textEn", '')));

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_triggerPartId_notSupport_idx" ON "UniqueAbilityLineFlat"("triggerPartId") WHERE "isSupport" = false;

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_conditionPartId_notSupport_idx" ON "UniqueAbilityLineFlat"("conditionPartId") WHERE "isSupport" = false;

-- CreateIndex
CREATE INDEX "UniqueAbilityLineFlat_effectPartId_notSupport_idx" ON "UniqueAbilityLineFlat"("effectPartId") WHERE "isSupport" = false;

CREATE INDEX "UniqueInfo_id_active_idx" ON "UniqueInfo"("id") WHERE "seenInLastGeneration" = true;