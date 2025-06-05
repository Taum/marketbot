-- DropIndex
DROP INDEX "UniqueInfo_lastSeenInSaleAt_idx";

-- CreateIndex
CREATE INDEX "UniqueInfo_lastSeenInSalePrice_idx" ON "UniqueInfo"("lastSeenInSalePrice");

-- CreateIndex
CREATE INDEX "UniqueInfo_cardSubTypes_gin_idx" ON "UniqueInfo" USING GIN("cardSubTypes");

-- Full text search indexes
CREATE INDEX "UniqueInfo_effectEn_fts_idx" ON "UniqueInfo" USING GIN(to_tsvector('english', (COALESCE("mainEffectEn", '') || ' ' || COALESCE("echoEffectEn", ''))));
