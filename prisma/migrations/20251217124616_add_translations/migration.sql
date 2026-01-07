-- AlterTable
ALTER TABLE "UniqueAbilityLine"
ADD COLUMN     "textFr" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "textEn" SET DEFAULT '';

-- AlterTable
ALTER TABLE "UniqueAbilityPart"
ADD COLUMN     "textFr" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "textEn" SET DEFAULT '';

-- AlterTable
ALTER TABLE "UniqueInfo"
ADD COLUMN     "echoEffectFr" TEXT,
ADD COLUMN     "mainEffectFr" TEXT,
ADD COLUMN     "nameFr" TEXT;
