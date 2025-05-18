-- CreateTable
CREATE TABLE "AltggSession" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshCookies" JSONB,

    CONSTRAINT "AltggSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AltggSession_id_idx" ON "AltggSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AltggSession_id_key" ON "AltggSession"("id");
