TRUNCATE TABLE "UniqueAbilityLine" CASCADE;
TRUNCATE TABLE "UniqueAbilityPart" CASCADE;
TRUNCATE TABLE "AbilityPartLink" CASCADE;

-- Reset the auto-increment sequences
ALTER SEQUENCE "UniqueAbilityLine_id_seq" RESTART WITH 1;
ALTER SEQUENCE "UniqueAbilityPart_id_seq" RESTART WITH 1;
ALTER SEQUENCE "AbilityPartLink_id_seq" RESTART WITH 1;

SELECT * FROM "UniqueAbilityLine";
SELECT * FROM "UniqueAbilityPart";
SELECT * FROM "AbilityPartLink";

