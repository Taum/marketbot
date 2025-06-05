import { UniqueInfo } from "@prisma/client";
import { useLoaderData } from "@remix-run/react";

import { db } from "@common/utils/kysely.server";
import { Expression } from "kysely";
import { sql } from "kysely";

function to_tsvector(expr: Expression<string | null> | string) {
  return sql`to_tsvector('english', COALESCE(${expr}, ''))`
}
function to_tsvector2(expr1: Expression<string | null> | string, expr2: Expression<string | null> | string) {
  return sql`to_tsvector('english', COALESCE(${expr1}, '') || ' ' || COALESCE(${expr2}, ''))`
}
function plainto_tsquery(expr: Expression<string> | string) {
  return sql`plainto_tsquery('english', ${expr})`
}
function phraseto_tsquery(expr: Expression<string> | string) {
  return sql`phraseto_tsquery('english', ${expr})`
}

export async function loader() {

  const query = db.selectFrom(`UniqueInfo`)
    .where(eb => eb(
      to_tsvector2(eb.ref('mainEffectEn'), eb.ref('echoEffectEn')),
      '@@',
      plainto_tsquery("when you play a permanent"),
    ))
    .where(eb => eb(
      to_tsvector2(eb.ref('mainEffectEn'), eb.ref('echoEffectEn')),
      '@@',
      phraseto_tsquery("i gain 2 boosts"),
    ))
    .where('UniqueInfo.seenInLastGeneration', '=', true)
    .selectAll()

  const plan = await query.explain('json')
  console.dir(plan, { depth: null })

  const uniques = await query.execute()

  return { uniques };
}

export default function DebugDrizzle() {
  const { uniques } = useLoaderData<typeof loader>();
  return <div>
    <h2>{uniques.length} results</h2>
    <ul>
      {uniques.map((unique) => (
        <li key={unique.id}>
          <pre>{unique.ref}</pre>
          <p>{unique.nameEn}</p>
          <p>{unique.mainEffectEn}</p>
          <p>{unique.echoEffectEn}</p>
          <hr />
        </li>
      ))}
    </ul>
  </div>
}
