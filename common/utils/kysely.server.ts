import { DB } from '@generated/kysely-db/types' // this is the Database interface we defined earlier
import { Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'

const dbUrl = process.env.DATABASE_URL


// We hack compatibility with Prisma's DATABASE_URL format here, so we don't have to
// change the container configurations.

// example: postgresql://test:test@localhost:5411/test
// example: postgresql://myUs3r:myP4ssw0rd@localhost:5432/dbName?host=/path/to/socket

if (!dbUrl) {
  throw new Error("DATABASE_URL is not set")
}

const url = new URL(dbUrl)
if (!url) {
  throw new Error("DATABASE_URL is not in the expected format")
}

if (url.protocol !== "postgresql:") {
  throw new Error("DATABASE_URL protocol is not postgresql")
}

const user = url.username
const password = url.password
const host = url.hostname
const port = url.port
const database = url.pathname.slice(1)

let params = {}
if (url.searchParams.get("host")) {
  params = {
    user,
    password,
    database,
    host: url.searchParams.get("host"),
  }
} else {
  params = {
    user,
    password,
    host,
    port,
    database,
  }
}


const dialect = new PostgresDialect({
  pool: new Pool({
    ...params,
    max: 15,
  })
})

// Database interface is passed to Kysely's constructor, and from now on, Kysely 
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how 
// to communicate with your database.
export const db = new Kysely<DB>({
  dialect,
})