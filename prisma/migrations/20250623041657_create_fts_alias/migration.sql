-- CreateTable
CREATE TABLE "FtsAlias" (
    "id" SERIAL NOT NULL,
    "from" TSQUERY NOT NULL,
    "to" TSQUERY NOT NULL,

    CONSTRAINT "FtsAlias_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FtsAlias_from_key" UNIQUE ("from")
);

INSERT INTO "FtsAlias" ("from", "to") VALUES
  ('landmark'::tsquery, 'landmark|landmarks'::tsquery),
  ('card'::tsquery, 'card|cards'::tsquery),
  ('character'::tsquery, 'character|characters'::tsquery),
  ('ability'::tsquery, 'ability|abilities'::tsquery),
  ('permanent'::tsquery, 'permanent|permanents'::tsquery),
  ('spell'::tsquery, 'spell|spells'::tsquery),
  ('expedition'::tsquery, 'expedition|expeditions'::tsquery),
  ('boost'::tsquery, 'boost|boosts'::tsquery);