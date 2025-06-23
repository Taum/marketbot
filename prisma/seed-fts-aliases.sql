INSERT INTO "FtsAlias" ("from", "to") VALUES
  ('landmark'::tsquery, 'landmark|landmarks'::tsquery),
  ('card'::tsquery, 'card|cards'::tsquery),
  ('character'::tsquery, 'character|characters'::tsquery),
  ('ability'::tsquery, 'ability|abilities'::tsquery),
  ('permanent'::tsquery, 'permanent|permanents'::tsquery),
  ('spell'::tsquery, 'spell|spells'::tsquery),
  ('expedition'::tsquery, 'expedition|expeditions'::tsquery),
  ('boost'::tsquery, 'boost|boosts'::tsquery);