import { pool } from '../client'

export async function ensureLabelNoteColumns() {
  const existing = await pool.query(`SELECT count(*)::int AS count FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'meracourierwala_label_preferences'
    AND column_name IN ('note_enabled', 'label_note')`)
  if (existing.rows[0]?.count === 2) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query(`ALTER TABLE IF EXISTS meracourierwala_label_preferences
      ADD COLUMN IF NOT EXISTS note_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS label_note varchar(240) NOT NULL DEFAULT ''`)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
