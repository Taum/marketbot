import { db } from "@common/utils/kysely.server";
import { sql } from "kysely";

async function listDistinctCardSubTypes() {
  try {
    console.log("Querying distinct cardSubTypes from UniqueInfo table...");
    
    // Query to get all distinct cardSubTypes values
    // Since cardSubTypes is an array, we need to unnest it to get distinct values
    const result = await db
      .selectFrom('UniqueInfo')
      .select(sql`unnest("cardSubTypes")`.as('cardSubType'))
      .distinct()
      .orderBy('cardSubType')
      .execute();

    console.log(`Found ${result.length} distinct card subtypes:`);
    console.log("=".repeat(50));
    
    result.forEach((row, index) => {
      console.log(`${index + 1}. ${row.cardSubType}`);
    });
    
    console.log("=".repeat(50));
    console.log(`Total: ${result.length} distinct card subtypes`);
    
    console.log(result.map(r => `"${r.cardSubType}"`).join(", "));
  } catch (error) {
    console.error("Error querying database:", error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// Run the script
listDistinctCardSubTypes().catch(console.error);
