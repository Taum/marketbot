/*
  Warnings:

  - Added the required column `userId` to the `AltggSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AltggSession" ADD COLUMN     "userId" TEXT NOT NULL;
