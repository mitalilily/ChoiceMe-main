import axios from 'axios'
import { and, count, eq, ilike } from 'drizzle-orm'
import { db } from '../client'
import { locations } from '../schema/locations'

type LocationLookup = {
  pincode: string
  city: string
  state: string
  country: string
  tags?: string[]
}

type IndiaPostOffice = {
  Pincode?: string | number | null
  District?: string | null
  Division?: string | null
  Region?: string | null
  State?: string | null
  Country?: string | null
}

type IndiaPostResponse = Array<{
  Status?: string
  PostOffice?: IndiaPostOffice[] | null
}> | {
  Status?: string
  PostOffice?: IndiaPostOffice[] | null
}

const normalizeText = (value: unknown) => String(value ?? '').trim()
const isIndianPincode = (value: unknown) => /^[1-9][0-9]{5}$/.test(normalizeText(value))
const postalLookupUrlTemplates = [
  'http://www.postalpincode.in/api/pincode/{pincode}',
]

const metroCityPatterns = [
  'ahmedabad',
  'bengaluru',
  'bangalore',
  'chennai',
  'delhi',
  'hyderabad',
  'kolkata',
  'mumbai',
  'pune',
]

const stateRegionMap: Record<string, string> = {
  'andaman and nicobar islands': 'south',
  'andhra pradesh': 'south',
  'arunachal pradesh': 'east',
  assam: 'east',
  bihar: 'east',
  chandigarh: 'north',
  chhattisgarh: 'west',
  'dadra and nagar haveli and daman and diu': 'west',
  delhi: 'north',
  goa: 'west',
  gujarat: 'west',
  haryana: 'north',
  'himachal pradesh': 'north',
  'jammu and kashmir': 'north',
  jharkhand: 'east',
  karnataka: 'south',
  kerala: 'south',
  ladakh: 'north',
  lakshadweep: 'south',
  'madhya pradesh': 'west',
  maharashtra: 'west',
  manipur: 'east',
  meghalaya: 'east',
  mizoram: 'east',
  nagaland: 'east',
  odisha: 'east',
  puducherry: 'south',
  punjab: 'north',
  rajasthan: 'north',
  sikkim: 'east',
  'tamil nadu': 'south',
  telangana: 'south',
  tripura: 'east',
  'uttar pradesh': 'north',
  uttarakhand: 'north',
  'west bengal': 'east',
}

const inferLocationTags = (city: string, state: string) => {
  const tags = new Set<string>()
  const normalizedCity = city.toLowerCase()
  const normalizedState = state.toLowerCase()

  if (metroCityPatterns.some((metro) => normalizedCity.includes(metro))) {
    tags.add('metros')
  }

  const region = stateRegionMap[normalizedState]
  if (region) tags.add(region)

  return Array.from(tags)
}

const dedupeLocations = (rows: LocationLookup[]) => {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.pincode}|${row.city.toLowerCase()}|${row.state.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const fetchPostalLocationsByPincode = async (
  pincode: string,
): Promise<LocationLookup[]> => {
  const normalizedPincode = normalizeText(pincode)
  if (!isIndianPincode(normalizedPincode)) return []

  let lastError: unknown = null

  for (const template of postalLookupUrlTemplates) {
    try {
      const res = await axios.get<IndiaPostResponse>(
        template.replace('{pincode}', normalizedPincode),
        { timeout: 8000 },
      )
      const payload = Array.isArray(res.data) ? res.data[0] : res.data
      const offices =
        normalizeText(payload?.Status).toLowerCase() === 'success' ? payload.PostOffice ?? [] : []

      return dedupeLocations(
        offices
          .map((office) => {
            const city =
              normalizeText(office.District) ||
              normalizeText(office.Division) ||
              normalizeText(office.Region)
            const state = normalizeText(office.State)

            return {
              pincode: normalizeText(office.Pincode) || normalizedPincode,
              city,
              state,
              country: normalizeText(office.Country) || 'India',
              tags: inferLocationTags(city, state),
            }
          })
          .filter((row) => row.pincode && row.city && row.state),
      )
    } catch (error) {
      lastError = error
    }
  }

  console.warn('[locations] India Post pincode lookup failed', {
    pincode: normalizedPincode,
    error: lastError instanceof Error ? lastError.message : lastError,
  })
  return []
}

export const LocationService = {
  create: async (data: { pincode: string; city: string; state: string; country?: string }) => {
    // Check if a location with the same pincode and city already exists
    const existing = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.pincode, data.pincode),
          eq(locations.city, data.city),
          eq(locations.state, data.state),
          eq(locations.country, data?.country ?? 'India'),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      throw new Error(`Location with pincode ${data.pincode} and city ${data.city} already exists`)
    }

    // Insert new location
    const [location] = await db
      .insert(locations)
      .values({
        ...data,
        country: data.country || 'India',
      })
      .returning()

    return location
  },

  list: async (params: {
    page?: number
    limit?: number
    filters?: { pincode?: string; city?: string; state?: string }
  }) => {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const offset = (page - 1) * limit

    const conditions = []
    if (params.filters) {
      const { pincode, city, state } = params.filters
      if (pincode) conditions.push(ilike(locations.pincode, `%${pincode}%`))
      if (city) conditions.push(ilike(locations.city, `%${city}%`))
      if (state) conditions.push(ilike(locations.state, `%${state}%`))
    }

    const data = await db
      .select()
      .from(locations)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset)

    if (!data.length && isIndianPincode(params.filters?.pincode)) {
      const externalLocations = await fetchPostalLocationsByPincode(params.filters!.pincode!)
      const pagedLocations = externalLocations.slice(offset, offset + limit)

      return {
        data: pagedLocations,
        total: externalLocations.length,
        page,
        limit,
      }
    }

    const totalRes = await db
      .select({ count: count() })
      .from(locations)
      .where(conditions.length ? and(...conditions) : undefined)

    const total = Number(totalRes[0]?.count ?? 0)
    return { data, total, page, limit }
  },

  lookupByPincode: async (pincode: string): Promise<LocationLookup | null> => {
    const normalizedPincode = normalizeText(pincode)
    if (!isIndianPincode(normalizedPincode)) return null

    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.pincode, normalizedPincode))
      .limit(1)

    if (location) {
      return {
        pincode: location.pincode,
        city: location.city,
        state: location.state,
        country: location.country,
        tags: Array.isArray(location.tags) ? location.tags.map((tag) => String(tag)) : [],
      }
    }

    return (await fetchPostalLocationsByPincode(normalizedPincode))[0] ?? null
  },

  getById: async (id: string) => {
    const [location] = await db.select().from(locations).where(eq(locations.id, id))
    return location
  },

  update: async (
    id: string,
    data: { pincode?: string; city?: string; state?: string; country?: string },
  ) => {
    const updated = await db.update(locations).set(data).where(eq(locations.id, id)).returning()
    return updated[0]
  },

  delete: async (id: string) => {
    const deleted = await db.delete(locations).where(eq(locations.id, id)).returning()
    return deleted[0]
  },
}
