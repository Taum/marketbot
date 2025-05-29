TRUNCATE TABLE "MainUniqueAbility" CASCADE;
TRUNCATE TABLE "MainUniqueAbilityPart" CASCADE;

-- Reset the auto-increment sequences
ALTER SEQUENCE "MainUniqueAbility_id_seq" RESTART WITH 1;
ALTER SEQUENCE "MainUniqueAbilityPart_id_seq" RESTART WITH 1;

SELECT * FROM "MainUniqueAbility";
SELECT * FROM "MainUniqueAbilityPart";

