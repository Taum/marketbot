/*
  Warnings:

  - A unique constraint covering the columns `[textEn,partType]` on the table `MainUniqueAbilityPart` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "MainUniqueAbilityPart_textEn_key";

-- CreateIndex
CREATE UNIQUE INDEX "MainUniqueAbilityPart_textEn_partType_key" ON "MainUniqueAbilityPart"("textEn", "partType");
