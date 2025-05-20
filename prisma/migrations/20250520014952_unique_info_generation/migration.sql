-- AlterTable
ALTER TABLE "UniqueInfo" ADD COLUMN     "firstSeenGenerationId" INTEGER,
ADD COLUMN     "lastSeenGenerationId" INTEGER;

UPDATE "UniqueInfo" SET "firstSeenGenerationId" = 1;

-- CreateTable
CREATE TABLE "MarketUpdateStats" (
    "generationId" SERIAL NOT NULL,
    "updateStartedAt" TIMESTAMP(3) NOT NULL,
    "updateCompletedAt" TIMESTAMP(3),

    CONSTRAINT "MarketUpdateStats_pkey" PRIMARY KEY ("generationId")
);

INSERT INTO "MarketUpdateStats" ("generationId", "updateStartedAt", "updateCompletedAt") VALUES (1, '2025-05-19T00:00:00Z', '2025-05-19T01:00:00Z');

-- CreateIndex
CREATE INDEX "MarketUpdateStats_generationId_idx" ON "MarketUpdateStats"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketUpdateStats_generationId_key" ON "MarketUpdateStats"("generationId");