-- CreateTable
CREATE TABLE "UniqueInfo" (
    "id" SERIAL NOT NULL,
    "ref" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "mainCost" INTEGER NOT NULL,
    "recallCost" INTEGER NOT NULL,
    "oceanPower" INTEGER,
    "mountainPower" INTEGER,
    "forestPower" INTEGER,
    "nameEn" TEXT NOT NULL,
    "imageUrlEn" TEXT NOT NULL,
    "imageUrlDe" TEXT,
    "imageUrlEs" TEXT,
    "imageUrlFr" TEXT,
    "imageUrlIt" TEXT,
    "mainEffectEn" TEXT,
    "echoEffectEn" TEXT,

    CONSTRAINT "UniqueInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UniqueInfo_ref_idx" ON "UniqueInfo"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueInfo_ref_key" ON "UniqueInfo"("ref");
