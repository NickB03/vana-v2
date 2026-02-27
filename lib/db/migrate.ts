import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import 'dotenv/config'

// This script is used to run migrations on the database
// Run it with: bun run lib/db/migrate.ts

const runMigrations = async () => {
  const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!dbUrl) {
    console.error(
      'DATABASE_URL or POSTGRES_URL is not defined in environment variables'
    )
    process.exit(1)
  }

  const connectionString = dbUrl

  // Respect DATABASE_SSL_DISABLED flag (used in Docker)
  // For cloud databases (Supabase, Neon, etc.), use SSL with rejectUnauthorized: false
  // For local databases (Docker, localhost), disable SSL
  const sslDisabled = process.env.DATABASE_SSL_DISABLED === 'true'
  const isProduction = process.env.NODE_ENV === 'production'

  const sql = postgres(connectionString, {
    ssl: sslDisabled
      ? false
      : isProduction
        ? { rejectUnauthorized: false }
        : false,
    prepare: false
  })

  const db = drizzle(sql)

  console.log('Running migrations...')

  try {
    await migrate(db, { migrationsFolder: 'drizzle' })
    console.log('Migrations completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  await sql.end()
  process.exit(0)
}

runMigrations()
