DROP INDEX IF EXISTS "UniqueInfo_effectEn_fts_idx";

CREATE INDEX "UniqueInfo_effectEn_fts_idx" ON "UniqueInfo" USING GIN(to_tsvector('simple', (COALESCE("mainEffectEn", '') || ' ' || COALESCE("echoEffectEn", ''))));
