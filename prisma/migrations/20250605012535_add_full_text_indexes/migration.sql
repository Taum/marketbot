-- DropIndex
DROP INDEX "UniqueInfo_lastSeenInSaleAt_idx";

-- CreateIndex
CREATE INDEX "UniqueInfo_lastSeenInSalePrice_idx" ON "UniqueInfo"("lastSeenInSalePrice");

-- Full text search indexes
CREATE INDEX "UniqueInfo_effectEn_fts_idx" ON "UniqueInfo" USING GIN(to_tsvector('simple', (COALESCE("mainEffectEn", '') || ' ' || COALESCE("echoEffectEn", ''))));
