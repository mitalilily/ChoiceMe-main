import { sql } from 'drizzle-orm'
import { db } from '../client'
import { couriers } from '../schema/couriers'
import { DELHIVERY_COURIER_IDS } from '../../utils/delhiveryCourier'

export const DELIVERY_ONE_SERVICE_PROVIDER = 'deliveryone'

export const DELIVERY_ONE_COURIER_CATALOG = [
  {
    id: DELHIVERY_COURIER_IDS.SURFACE,
    name: 'Delhivery Surface',
    shippingMode: 'Surface',
    mode: 'surface',
  },
  {
    id: DELHIVERY_COURIER_IDS.EXPRESS,
    name: 'Delhivery Express',
    shippingMode: 'Express',
    mode: 'air',
  },
] as const

export type DeliveryOneCourierCatalogItem = {
  id: number
  name: string
  displayName: string
  serviceProvider: string
  service_provider: string
  isEnabled: boolean
  businessType: ('b2c' | 'b2b')[]
  mode: string
  shipping_mode: string
  shippingMode: string
  createdAt: Date | null
  updatedAt: Date | null
}

export const getDeliveryOneCourierCatalog = (): DeliveryOneCourierCatalogItem[] =>
  DELIVERY_ONE_COURIER_CATALOG.map((courier) => ({
    id: courier.id,
    name: courier.name,
    displayName: courier.name,
    serviceProvider: DELIVERY_ONE_SERVICE_PROVIDER,
    service_provider: DELIVERY_ONE_SERVICE_PROVIDER,
    isEnabled: true,
    businessType: ['b2c'],
    mode: courier.mode,
    shipping_mode: courier.mode,
    shippingMode: courier.shippingMode,
    createdAt: null,
    updatedAt: null,
  }))

export const ensureDeliveryOneCouriers = async () => {
  const legacySeedingEnabled = ['1', 'true', 'yes'].includes(
    String(process.env.ENABLE_LEGACY_DELIVERYONE_COURIERS || '').trim().toLowerCase(),
  )
  if (!legacySeedingEnabled) return

  const businessType: ('b2c' | 'b2b')[] = ['b2c']

  await db
    .insert(couriers)
    .values(
      DELIVERY_ONE_COURIER_CATALOG.map((courier) => ({
        id: courier.id,
        name: courier.name,
        serviceProvider: DELIVERY_ONE_SERVICE_PROVIDER,
        businessType,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    )
    .onConflictDoUpdate({
      target: [couriers.id, couriers.serviceProvider],
      set: {
        name: sql`excluded.name`,
        businessType,
        isEnabled: true,
        updatedAt: new Date(),
      },
    })
}
