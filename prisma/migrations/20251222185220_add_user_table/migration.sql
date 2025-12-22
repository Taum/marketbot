/*
  Warnings:

  - You are about to alter the column `from` on the `FtsAlias` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("tsquery")` to `Text`.
  - You are about to alter the column `to` on the `FtsAlias` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("tsquery")` to `Text`.
  - A unique constraint covering the columns `[id]` on the table `FtsAlias` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "FtsAlias" ALTER COLUMN "from" SET DATA TYPE TEXT,
ALTER COLUMN "to" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FtsAlias_from_idx" ON "FtsAlias"("from");

-- CreateIndex
CREATE UNIQUE INDEX "FtsAlias_id_key" ON "FtsAlias"("id");

-- CreateIndex
CREATE INDEX "UniqueAbilityPart_textFr_idx" ON "UniqueAbilityPart"("textFr");
