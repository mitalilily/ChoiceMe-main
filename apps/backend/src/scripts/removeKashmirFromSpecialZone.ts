import { sql } from 'drizzle-orm'
import { db } from '../models/client'
import { locations } from '../models/schema/locations'

async function removeKashmirFromSpecialZoneTags() {
  const updated = await db
    .update(locations)
    .set({
      tags: sql`coalesce(${locations.tags}, '[]'::jsonb) - 'special_zone' - 'special_zones'`,
    })
    .where(
      sql`lower(${locations.state}) like '%kashmir%' or lower(${locations.state}) like '%ladakh%'`,
    )
    .returning({ id: locations.id })

  console.log(`Removed special-zone tags from ${updated.length} Kashmir/Ladakh location rows.`)
}

removeKashmirFromSpecialZoneTags().catch((error) => {
  console.error('Failed to remove Kashmir from special zone tags:', error)
  process.exitCode = 1
})
