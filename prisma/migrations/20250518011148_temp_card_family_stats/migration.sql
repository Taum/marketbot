-- CreateTable
CREATE TABLE "CardFamilyStats" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL,

    CONSTRAINT "CardFamilyStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardFamilyStats_id_idx" ON "CardFamilyStats"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CardFamilyStats_id_key" ON "CardFamilyStats"("id");
