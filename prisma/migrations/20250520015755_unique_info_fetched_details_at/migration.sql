-- AlterTable
ALTER TABLE "UniqueInfo" ADD COLUMN     "fetchedDetailsAt" TIMESTAMP(3);

UPDATE "UniqueInfo" SET "fetchedDetailsAt" = NOW();