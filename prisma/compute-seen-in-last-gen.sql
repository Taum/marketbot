UPDATE "UniqueInfo" ui
SET "seenInLastGeneration" = COALESCE(
  ui."lastSeenGenerationId" >= (
    SELECT cfs."fetchCompletedGeneration"
    FROM "CardFamilyStats" cfs
    WHERE cfs."cardFamilyId" = ui."cardFamilyId"
    AND cfs."faction" = ui."faction"
    FOR SHARE
  ),
  -- Default to true if we didn't get this from a family -- currently because it's a card from BISE
  true
);

SELECT COUNT(*) FROM "UniqueInfo" GROUP BY "seenInLastGeneration";
