// services/pickupAddresses.service.ts
import { and, asc, desc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import { CreatePickupDto, HydratedPickupAddress, UpdatePickupDto } from '../../types/generic.types'
import { db } from '../client'
import { addresses, pickupAddresses } from '../schema/pickupAddresses'
import { DelhiveryService } from './couriers/delhivery.service'
import { DeliveryOneService } from './couriers/deliveryone.service'
import { EkartService } from './couriers/ekart.service'

function parseCoordinate(value: string | null | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getCourierErrorText(rawError: any, err?: any) {
  const candidates = [
    rawError?.detail,
    rawError?.error?.[0],
    rawError?.error,
    rawError?.message,
    rawError?.data?.message,
    err?.message,
  ]

  return candidates
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .map((value) => String(value))
    .join(' | ')
}

function isCourierAuthOrConfigError(rawError: any, err?: any) {
  const status = Number(err?.statusCode || err?.status || err?.response?.status || rawError?.status || 0)
  const text = getCourierErrorText(rawError, err).toLowerCase()

  return (
    status === 401 ||
    status === 403 ||
    text.includes('invalid token') ||
    text.includes('unauthorized') ||
    text.includes('forbidden') ||
    text.includes('api key is not configured') ||
    text.includes('token is not configured') ||
    text.includes('credentials') ||
    text.includes('authentication')
  )
}

function isCourierWarehouseMissingError(rawError: any, err?: any) {
  const text = getCourierErrorText(rawError, err).toLowerCase()

  return (
    text.includes('warehouse does not exists') ||
    text.includes('warehouse does not exist') ||
    text.includes('warehouse not found') ||
    text.includes('clientwarehouse does not exist') ||
    text.includes('client warehouse does not exist')
  )
}

function isCourierWarehouseAlreadyExistsError(rawError: any, err?: any) {
  const text = getCourierErrorText(rawError, err).toLowerCase()

  return text.includes('already exists') && (text.includes('warehouse') || text.includes('client'))
}

type CourierAddressLike = {
  addressLine1?: string | number | null
  addressLine2?: string | number | null
  landmark?: string | number | null
  city?: string | number | null
  state?: string | number | null
  country?: string | number | null
  pincode?: string | number | null
}

function cleanAddressPart(value: string | number | null | undefined) {
  return String(value ?? '').trim()
}

function buildCourierAddress(address: CourierAddressLike | null | undefined) {
  const seen = new Set<string>()
  const parts = [
    address?.addressLine1,
    address?.addressLine2,
    address?.landmark,
    address?.city,
    address?.state,
    address?.country,
    address?.pincode,
  ]
    .map(cleanAddressPart)
    .filter((part) => {
      if (!part || seen.has(part.toLowerCase())) return false
      seen.add(part.toLowerCase())
      return true
    })

  return parts.join(', ')
}

/**
 * Create Pickup + optional RTO
 */

export async function createPickupAddressService(data: CreatePickupDto, userId: string) {
  return await db.transaction(async (txn) => {
    const existing = await txn.query.pickupAddresses.findFirst({
      where: eq(pickupAddresses.userId, userId),
    })

    const isPrimary = !existing

    // 🔹 Reset existing primary if new one is requested
    if (data.isPrimary && existing) {
      await txn
        .update(pickupAddresses)
        .set({ isPrimary: false })
        .where(eq(pickupAddresses.userId, userId))
    }

    // 🔹 Insert pickup address
    const [pickupAddr] = await txn
      .insert(addresses)
      .values({
        userId,
        type: 'pickup',
        ...data.pickup,
      })
      .returning()

    // 🔹 Insert optional RTO address
    let rtoAddressId: string | null = null
    let isRTOSame = true
    let rtoAddressData = pickupAddr

    if (data?.rtoAddress) {
      const [rtoAddr] = await txn
        .insert(addresses)
        .values({
          userId,
          type: 'rto',
          ...data.rtoAddress,
        })
        .returning()
      rtoAddressId = rtoAddr.id
      isRTOSame = false
      rtoAddressData = rtoAddr
    } else {
      rtoAddressId = pickupAddr.id
    }

    // 🔹 Link in pickup_addresses
    const [created] = await txn
      .insert(pickupAddresses)
      .values({
        userId,
        addressId: pickupAddr.id,
        rtoAddressId,
        isPrimary: data.isPrimary ?? isPrimary,
        isPickupEnabled: data.isPickupEnabled ?? true,
        isRTOSame,
      })
      .returning()

    const pickupAddressText = buildCourierAddress(pickupAddr)
    const returnAddressText = buildCourierAddress(rtoAddressData) || pickupAddressText

    // 🚚 Register pickup in Delhivery
    try {
      const delhivery = new DelhiveryService()
      const delhiveryResp = await delhivery.createWarehouse({
        name: pickupAddr.addressNickname ?? pickupAddr.contactName ?? 'Default Warehouse',
        registered_name: 'ChoiceMee',
        phone: pickupAddr.contactPhone,
        email: pickupAddr.contactEmail ?? '',
        address: pickupAddressText || pickupAddr.addressLine1,
        city: pickupAddr.city,
        pin: pickupAddr.pincode.toString(),
        country: pickupAddr.country ?? 'India',
        return_address: returnAddressText || pickupAddressText || pickupAddr.addressLine1,
        return_city: rtoAddressData.city ?? pickupAddr.city,
        return_pin: rtoAddressData.pincode?.toString() ?? pickupAddr.pincode?.toString(),
        return_state: rtoAddressData.state ?? pickupAddr.state,
        return_country: 'India',
      })

      if (!delhiveryResp || delhiveryResp.success === false) {
        console.error('❌ Delhivery warehouse creation failed:', delhiveryResp)
        const errorToThrow: any = new Error('Delhivery warehouse registration failed')
        errorToThrow.code = 'DELHIVERY_WAREHOUSE_GENERAL_ERROR'
        throw errorToThrow
      }

      console.log(`✅ Delhivery warehouse registered: ${pickupAddr.addressNickname}`)
    } catch (err: any) {
      const rawError = err?.response?.data ?? err
      console.error('❌ Error registering Delhivery warehouse:', rawError)

      // Detect duplicate-warehouse error from Delhivery and throw a typed error
      const delhiveryErrorText = getCourierErrorText(rawError, err)

      if (typeof delhiveryErrorText === 'string') {
        if (
          delhiveryErrorText.includes('client-warehouse of client') &&
          delhiveryErrorText.toLowerCase().includes('already exists')
        ) {
          const duplicateErr: any = new Error(
            'A pickup location with this nickname already exists. Please choose a different nickname.',
          )
          duplicateErr.code = 'DELHIVERY_WAREHOUSE_NAME_EXISTS'
          duplicateErr.field = 'pickup.addressNickname'
          throw duplicateErr
        }

        if (delhiveryErrorText.toLowerCase().includes('serviceability')) {
          const serviceabilityErr: any = new Error(
            'This pickup pincode is not serviceable for pickups. Please use a different pincode.',
          )
          serviceabilityErr.code = 'PICKUP_PIN_NOT_SERVICEABLE'
          serviceabilityErr.field = 'pickup.pincode'
          throw serviceabilityErr
        }
      }

      if (isCourierAuthOrConfigError(rawError, err)) {
        console.warn(
          'âš ï¸ Skipping Delhivery warehouse registration because credentials are invalid or missing. Pickup address was saved locally.',
          rawError,
        )
      } else {
        const genericErr: any = new Error(
          'Pickup location could not be verified. Please check the address details and try again.',
        )
        genericErr.code = 'DELHIVERY_WAREHOUSE_GENERAL_ERROR'
        throw genericErr
      }
    }

    // Delivery One uses the same warehouse registration contract. Keep this best-effort so
    // missing Delivery One credentials do not block local pickup address creation.
    try {
      const deliveryOne = new DeliveryOneService()
      await deliveryOne.createWarehouse({
        name: pickupAddr.addressNickname ?? pickupAddr.contactName ?? 'Default Warehouse',
        registered_name: 'ChoiceMee',
        phone: pickupAddr.contactPhone,
        email: pickupAddr.contactEmail ?? '',
        address: pickupAddressText || pickupAddr.addressLine1,
        city: pickupAddr.city,
        pin: pickupAddr.pincode.toString(),
        country: pickupAddr.country ?? 'India',
        return_address: returnAddressText || pickupAddressText || pickupAddr.addressLine1,
        return_city: rtoAddressData.city ?? pickupAddr.city,
        return_pin: rtoAddressData.pincode?.toString() ?? pickupAddr.pincode?.toString(),
        return_state: rtoAddressData.state ?? pickupAddr.state,
        return_country: 'India',
      })
      console.log(`✅ Delivery One warehouse registered: ${pickupAddr.addressNickname}`)
    } catch (err: any) {
      console.warn(
        '⚠️ Failed to register Delivery One warehouse:',
        err?.response?.data || err?.message || err,
      )
    }

    try {
      const ekart = new EkartService()
      const alias = pickupAddr.addressNickname || pickupAddr.contactName || `warehouse-${pickupAddr.id}`
      const phoneRaw = String(pickupAddr.contactPhone || '')
      const phoneDigits = phoneRaw.replace(/\D/g, '')
      const geo = {
        lat: parseCoordinate(pickupAddr.latitude, 0),
        lon: parseCoordinate(pickupAddr.longitude, 0),
      }
      const payload = {
        alias,
        contactName: pickupAddr.contactName || 'ChoiceMee',
        phone: Number(phoneDigits) || 0,
        email: pickupAddr.contactEmail || '',
        addressLine1: pickupAddr.addressLine1,
        addressLine2: pickupAddr.addressLine2 || '',
        city: pickupAddr.city,
        state: pickupAddr.state,
        pincode: Number(pickupAddr.pincode) || 0,
        country: (pickupAddr.country || 'India').toUpperCase(),
        geo,
        returnAddress: {
          contactName: pickupAddr.contactName || 'ChoiceMee',
          phone: Number(phoneDigits) || 0,
          addressLine1: pickupAddr.addressLine1,
          addressLine2: pickupAddr.addressLine2 || '',
          city: pickupAddr.city,
          state: pickupAddr.state,
          pincode: Number(pickupAddr.pincode) || 0,
          country: (pickupAddr.country || 'India').toUpperCase(),
          geo,
        },
      }
      await ekart.createWarehouse(payload)
      console.log(`✅ Ekart warehouse registered: ${alias}`)
    } catch (err: any) {
      console.warn('⚠️ Failed to register Ekart warehouse:', err?.response?.data || err?.message || err)
    }

    return created
  })
}
/**
 * Update Pickup + optional RTO
 */

export async function updatePickupAddressService(
  pickupId: string | null,
  userId: string,
  data: UpdatePickupDto & { id?: string },
) {
  try {
    const targetPickupId = pickupId ?? data.id
    if (!targetPickupId) throw new Error('Pickup ID is required')

    // ✅ Handle primary switch (if making this the new primary)
    if (data.isPrimary) {
      await db
        .update(pickupAddresses)
        .set({ isPrimary: false })
        .where(and(eq(pickupAddresses.userId, userId), ne(pickupAddresses.id, targetPickupId)))
    }

    // ✅ Update pickup record (flags only)
    const [pickup] = await db
      .update(pickupAddresses)
      .set({
        isPrimary: data.isPrimary,
        isPickupEnabled: data.isPickupEnabled ?? true,
      })
      .where(and(eq(pickupAddresses.id, targetPickupId), eq(pickupAddresses.userId, userId)))
      .returning()

    if (!pickup) return null

    // 🟡 If only flags are provided (no pickup or RTO details) — skip courier syncs
    const onlyFlagsChanged = !data.pickup && !data.rtoAddress
    if (onlyFlagsChanged) {
      console.log('⚙️ Only flags updated (isPrimary/isPickupEnabled). Skipping courier syncs.')
      return pickup
    }

    // ✅ Start transaction for atomic updates
    return await db.transaction(async (txn) => {
      // ✅ Update pickup address itself
      let updatedPickup: any = null
      let originalPickup: any = null
      if (data.pickup && pickup.addressId) {
        const [existingPickup] = await txn
          .select()
          .from(addresses)
          .where(eq(addresses.id, pickup.addressId))
          .limit(1)
        originalPickup = existingPickup

        const { createdAt, ...safeData } = data.pickup
        const [addr] = await txn
          .update(addresses)
          .set({
            ...safeData,
            updatedAt: new Date(),
          })
          .where(eq(addresses.id, pickup.addressId))
          .returning()
        updatedPickup = addr
      }

      // ✅ Update / Create RTO address
      if (data.rtoAddress) {
        if (pickup.rtoAddressId) {
          const { createdAt, ...safeData } = data?.rtoAddress
          await txn
            .update(addresses)
            .set({ ...safeData, updatedAt: new Date() })
            .where(eq(addresses.id, pickup.rtoAddressId))
        } else {
          const [newRto] = await txn
            .insert(addresses)
            .values({
              userId,
              type: 'rto',
              contactName: data.rtoAddress.contactName!,
              contactPhone: data.rtoAddress.contactPhone!,
              addressLine1: data.rtoAddress.addressLine1!,
              city: data.rtoAddress.city!,
              state: data.rtoAddress.state!,
              country: data.rtoAddress.country ?? 'India',
              pincode: data.rtoAddress.pincode!,
              contactEmail: data.rtoAddress.contactEmail,
              addressLine2: data.rtoAddress.addressLine2,
              landmark: data.rtoAddress.landmark,
              gstNumber: data.rtoAddress.gstNumber,
            })
            .returning()

          await txn
            .update(pickupAddresses)
            .set({ rtoAddressId: newRto.id, isRTOSame: false })
            .where(eq(pickupAddresses.id, targetPickupId))
        }
      }

      // 🟢 Sync with Delhivery (only if pickup address actually changed)
      try {
        if (updatedPickup) {
          const courierWarehouseName =
            originalPickup?.addressNickname ??
            originalPickup?.contactName ??
            updatedPickup?.addressNickname ??
            updatedPickup?.contactName ??
            'Default Warehouse'
          const delhivery = new DelhiveryService()
          const delhiveryResp = await delhivery.updateWarehouse({
            // Courier warehouse names are case-sensitive and cannot be renamed.
            // Use the original saved name even when the local display nickname changes.
            name: courierWarehouseName,
            address: buildCourierAddress(updatedPickup) || updatedPickup?.addressLine1,
            pin: updatedPickup?.pincode?.toString(),
            phone: updatedPickup?.contactPhone,
          })

          if (!delhiveryResp || delhiveryResp.success === false) {
            console.error('❌ Failed to update warehouse in Delhivery:', delhiveryResp)
            console.warn('Delhivery warehouse update failed; pickup address update was saved locally.')
            // Continue with Delivery One sync even if Delhivery update is rejected.
          } else {
            console.log(`✅ Warehouse updated in Delhivery: ${updatedPickup?.addressNickname}`)
          }
        } else {
          console.log('ℹ️ No pickup address change detected — skipped Delhivery update.')
        }
      } catch (err: any) {
        console.error('❌ Delhivery warehouse update error:', err.message)
        const rawError = err?.response?.data ?? err
        if (isCourierAuthOrConfigError(rawError, err)) {
          console.warn(
            'Skipping Delhivery warehouse update because credentials are invalid or missing. Pickup address update was saved locally.',
          )
        } else if (isCourierWarehouseMissingError(rawError, err)) {
          console.warn(
            'Skipping Delhivery warehouse update because the warehouse does not exist in the courier panel. Pickup address update was saved locally.',
          )
        } else {
          console.warn(
            'Skipping Delhivery warehouse update because the courier API rejected it. Pickup address update was saved locally:',
            getCourierErrorText(rawError, err) || err?.message || err,
          )
        }
      }

      try {
        if (updatedPickup) {
          const originalWarehouseName =
            originalPickup?.addressNickname ??
            originalPickup?.contactName ??
            updatedPickup?.addressNickname ??
            updatedPickup?.contactName ??
            'Default Warehouse'
          const currentWarehouseName =
            updatedPickup?.addressNickname ??
            updatedPickup?.contactName ??
            originalWarehouseName
          const pickupAddressText = buildCourierAddress(updatedPickup) || updatedPickup?.addressLine1
          const deliveryOne = new DeliveryOneService()
          let currentWarehouseRegistered = false

          const createCurrentDeliveryOneWarehouse = async (reason: string) => {
            if (currentWarehouseRegistered) return
            try {
              await deliveryOne.createWarehouse({
                name: currentWarehouseName,
                registered_name: 'ChoiceMee',
                phone: updatedPickup?.contactPhone,
                email: updatedPickup?.contactEmail ?? '',
                address: pickupAddressText,
                city: updatedPickup?.city,
                pin: updatedPickup?.pincode?.toString(),
                country: updatedPickup?.country ?? 'India',
                return_address: pickupAddressText,
                return_city: updatedPickup?.city,
                return_pin: updatedPickup?.pincode?.toString(),
                return_state: updatedPickup?.state,
                return_country: 'India',
              })
              currentWarehouseRegistered = true
              console.log(`Delivery One warehouse registered after pickup update: ${currentWarehouseName}`)
            } catch (createErr: any) {
              const rawCreateError = createErr?.response?.data ?? createErr
              if (isCourierWarehouseAlreadyExistsError(rawCreateError, createErr)) {
                currentWarehouseRegistered = true
                console.log(`Delivery One warehouse already exists after pickup update: ${currentWarehouseName}`)
                return
              }
              console.warn(
                `Skipping Delivery One warehouse registration (${reason}). Pickup address update was saved locally:`,
                getCourierErrorText(rawCreateError, createErr) || createErr?.message || createErr,
              )
            }
          }

          try {
            await deliveryOne.updateWarehouse({
              name: originalWarehouseName,
              address: pickupAddressText,
              pin: updatedPickup?.pincode?.toString(),
              phone: updatedPickup?.contactPhone,
            })
            console.log(`Delivery One warehouse updated: ${originalWarehouseName}`)
          } catch (err: any) {
            const rawError = err?.response?.data ?? err
            if (isCourierAuthOrConfigError(rawError, err)) {
              console.warn(
                'Skipping Delivery One warehouse update because credentials are invalid or missing. Pickup address update was saved locally.',
              )
            } else if (isCourierWarehouseMissingError(rawError, err)) {
              console.warn(
                'Delivery One warehouse is missing in the courier panel. Registering the current pickup warehouse.',
              )
              await createCurrentDeliveryOneWarehouse('warehouse missing in courier panel')
            } else {
              console.warn(
                'Skipping Delivery One warehouse update because the courier API rejected it. Pickup address update was saved locally:',
                getCourierErrorText(rawError, err) || err?.message || err,
              )
            }
          }

          if (
            String(currentWarehouseName).trim().toLowerCase() !==
            String(originalWarehouseName).trim().toLowerCase()
          ) {
            await createCurrentDeliveryOneWarehouse('pickup nickname changed')
          }
        } else {
          console.log('No pickup address change detected - skipped Delivery One update.')
        }
      } catch (err: any) {
        console.warn(
          'Skipping Delivery One warehouse sync because the courier API rejected it. Pickup address update was saved locally:',
          err?.response?.data || err?.message || err,
        )
      }

      return pickup
    })
  } catch (error) {
    console.error('❌ Failed to update pickup address:', error)
    throw new Error('Failed to update pickup address')
  }
}

/**
 * Get pickup addresses with hydrated pickup + rto
 */

export async function getPickupAddressesService(
  userId: string,
  filters: Record<string, any> = {},
  page = 1,
  limit = 10,
): Promise<{ data: HydratedPickupAddress[]; totalCount: number }> {
  const conditions: any[] = [eq(pickupAddresses.userId, userId)]

  // ✅ Pickup status filters
  if (filters.isPickupEnabled === 'active')
    conditions.push(eq(pickupAddresses.isPickupEnabled, true))
  if (filters.isPickupEnabled === 'inactive')
    conditions.push(eq(pickupAddresses.isPickupEnabled, false))
  if (filters.isPrimary !== undefined && filters.isPrimary !== '')
    conditions.push(eq(pickupAddresses.isPrimary, filters.isPrimary === 'true'))

  // ✅ Helper for pickup OR rto field
  const pickupOrRto = (field: string, value: string) => {
    const search = `%${value}%`
    return or(
      ilike((addresses as any)[field], search),
      sql<boolean>`EXISTS (
        SELECT 1 FROM addresses rto
        WHERE rto.id = ${pickupAddresses.rtoAddressId}
          AND rto.${sql.identifier(field)} ILIKE ${search}
      )`,
    )
  }

  // ✅ Field-specific filters
  if (filters.name) conditions.push(pickupOrRto('addressNickname', filters.name))
  if (filters.city) conditions.push(pickupOrRto('city', filters.city))
  if (filters.state) conditions.push(pickupOrRto('state', filters.state))
  if (filters.pincode) conditions.push(pickupOrRto('pincode', filters.pincode))

  // ✅ Sorting
  let sortByClause = desc(addresses.createdAt)
  switch (filters.sortBy) {
    case 'oldest':
      sortByClause = asc(addresses.createdAt)
      break
    case 'az':
      sortByClause = asc(addresses.contactName)
      break
    case 'za':
      sortByClause = desc(addresses.contactName)
      break
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // ✅ Count query
  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pickupAddresses)
    .innerJoin(addresses, eq(pickupAddresses.addressId, addresses.id))
    .where(whereClause) // safe: Drizzle skips undefined

  const totalCount = Number(totalCountResult[0]?.count ?? 0)

  const offset = (page - 1) * limit

  // ✅ Data query
  const data = await db
    .select({
      pickupId: pickupAddresses.id,
      isPrimary: pickupAddresses.isPrimary,
      isPickupEnabled: pickupAddresses.isPickupEnabled,
      isRTOSame: pickupAddresses.isRTOSame,
      pickup: {
        id: addresses.id,
        userId: addresses.userId,
        type: addresses.type,
        contactName: addresses.contactName,
        contactPhone: addresses.contactPhone,
        addressNickname: addresses.addressNickname,
        contactEmail: addresses.contactEmail,
        addressLine1: addresses.addressLine1,
        addressLine2: addresses.addressLine2,
        landmark: addresses.landmark,
        city: addresses.city,
        state: addresses.state,
        country: addresses.country,
        pincode: addresses.pincode,
        latitude: addresses.latitude,
        longitude: addresses.longitude,
        gstNumber: addresses.gstNumber,
        createdAt: addresses.createdAt,
        updatedAt: addresses.updatedAt,
      },
      rto: sql/*sql*/ `
      CASE 
        WHEN ${pickupAddresses.isRTOSame} = false THEN (
          SELECT row_to_json(a)
          FROM addresses a
          WHERE a.id = ${pickupAddresses.rtoAddressId}
        )
        ELSE NULL
      END
    `.as('rto'),
    })
    .from(pickupAddresses)
    .innerJoin(addresses, eq(pickupAddresses.addressId, addresses.id))
    .where(whereClause)
    .orderBy(sortByClause)
    .limit(limit)
    .offset(offset)

  return { data: data as unknown as HydratedPickupAddress[], totalCount }
}

