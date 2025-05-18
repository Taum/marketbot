/*
  Warnings:

  - Added the required column `cardSet` to the `UniqueInfo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UniqueInfo" ADD COLUMN     "cardSet" TEXT NOT NULL,
ADD COLUMN     "lastSeenInSaleAt" TIMESTAMP(3);
