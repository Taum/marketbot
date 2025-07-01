UPDATE "UniqueInfo" SET "imageUrlEn" = NULL, "fetchedDetails" = FALSE WHERE "imageUrlEn" not ilike '%/UNIQUE/%';

-- SELECT ref, "imageUrlEn", "fetchedDetails" FROM "UniqueInfo" WHERE "imageUrlEn" NOT ILIKE '%/UNIQUE/%';