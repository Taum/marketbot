import { DB } from '@generated/kysely-db/types' // this is the Database interface we defined earlier
import { Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'



const dialect = new PostgresDialect({
  pool: new Pool({
    database: 'test',
    host: 'localhost',
    user: 'test',
    password: 'test',
    port: 5411,
    max: 10,
  })
})

// Database interface is passed to Kysely's constructor, and from now on, Kysely 
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how 
// to communicate with your database.
export const db = new Kysely<DB>({
  dialect,
})