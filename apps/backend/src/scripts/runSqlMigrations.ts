import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { pool } from '../models/client'

type PgMigrationError = Error & {
  code?: string
  detail?: string
}

type MigrationFile = {
  label: string
  fullPath: string
}

const SKIPPABLE_ERROR_CODES = new Set([
  '42701', // duplicate_column
  '42703', // undefined_column, usually old source columns already removed
  '42710', // duplicate_object
  '42P01', // undefined_table, legacy table not present in this database
  '42P07', // duplicate_table
  '42P16', // invalid_table_definition, e.g. multiple primary keys
  '2BP01', // dependent_objects_still_exist
])

function isSkippableError(error: PgMigrationError): boolean {
  const message = error.message.toLowerCase()

  return (
    (error.code !== undefined && SKIPPABLE_ERROR_CODES.has(error.code)) ||
    message.includes('already exists') ||
    message.includes('does not exist') ||
    message.includes('multiple primary keys')
  )
}

function addSqlFilesFromDirectory(directory: string, pattern: RegExp, prefix: string): MigrationFile[] {
  try {
    return readdirSync(directory)
      .filter((file) => pattern.test(file))
      .sort((left, right) => left.localeCompare(right))
      .map((file) => ({
        label: `${prefix}/${file}`,
        fullPath: path.join(directory, file),
      }))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false
  let dollarTag: string | null = null

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const nextChar = sql[index + 1]

    if (inLineComment) {
      current += char
      if (char === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      current += char
      if (char === '*' && nextChar === '/') {
        current += nextChar
        index += 1
        inBlockComment = false
      }
      continue
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag
        index += dollarTag.length - 1
        dollarTag = null
      } else {
        current += char
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && nextChar === '-') {
      current += char + nextChar
      index += 1
      inLineComment = true
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '/' && nextChar === '*') {
      current += char + nextChar
      index += 1
      inBlockComment = true
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '$') {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)
      if (match) {
        dollarTag = match[0]
        current += dollarTag
        index += dollarTag.length - 1
        continue
      }
    }

    if (!inDoubleQuote && char === "'") {
      current += char
      if (inSingleQuote && nextChar === "'") {
        current += nextChar
        index += 1
      } else {
        inSingleQuote = !inSingleQuote
      }
      continue
    }

    if (!inSingleQuote && char === '"') {
      current += char
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === ';') {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
      continue
    }

    current += char
  }

  const trailingStatement = current.trim()
  if (trailingStatement) statements.push(trailingStatement)

  return statements
}

function getMigrationFiles(): MigrationFile[] {
  const backendRoot = path.resolve(__dirname, '../..')
  const drizzleMigrationsDir = path.join(backendRoot, 'src/drizzle/migrations')

  return [
    ...addSqlFilesFromDirectory(drizzleMigrationsDir, /^\d+.*\.sql$/, 'drizzle'),
    ...addSqlFilesFromDirectory(backendRoot, /^migration_.*\.sql$/, 'backend'),
  ]
}

async function runSqlMigrations() {
  const migrationFiles = getMigrationFiles()
  const client = await pool.connect()
  const failures: string[] = []
  let executedStatements = 0
  let skippedStatements = 0

  try {
    console.log(`Found ${migrationFiles.length} SQL migration file(s).`)

    for (const migrationFile of migrationFiles) {
      const sql = readFileSync(migrationFile.fullPath, 'utf8')
      const statements = splitSqlStatements(sql)

      console.log(`Running ${migrationFile.label} (${statements.length} statement(s))`)

      for (let index = 0; index < statements.length; index += 1) {
        try {
          await client.query(statements[index])
          executedStatements += 1
        } catch (error) {
          const pgError = error as PgMigrationError
          const location = `${migrationFile.label} statement ${index + 1}`

          if (isSkippableError(pgError)) {
            skippedStatements += 1
            console.warn(`Skipped ${location}: ${pgError.message}`)
            continue
          }

          failures.push(`${location}: ${pgError.message}`)
          console.error(`Failed ${location}: ${pgError.message}`)
        }
      }
    }
  } finally {
    client.release()
    await pool.end()
  }

  console.log(
    `SQL migrations complete. Executed: ${executedStatements}, skipped: ${skippedStatements}, failed: ${failures.length}.`,
  )

  if (failures.length > 0) {
    throw new Error(`Unexpected SQL migration failures:\n${failures.join('\n')}`)
  }
}

runSqlMigrations().catch((error) => {
  console.error(error)
  process.exit(1)
})
