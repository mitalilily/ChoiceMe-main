import { eq } from 'drizzle-orm'
import { db } from '../client'
import { labelPreferences } from '../schema/labelPreferences'

const PLATFORM_BRAND_NAME = 'ChoiceMee Courier'

export const DEFAULT_PREFERENCES = {
  printer_type: 'thermal',
  char_limit: 25,
  max_items: 3,
  order_info: {
    orderId: true,
    invoiceNumber: true,
    orderDate: false,
    invoiceDate: false,
    orderBarcode: true,
    invoiceBarcode: true,
    declaredValue: true,
    cod: true,
    awb: true,
    terms: true,
  },
  shipper_info: {
    shipperPhone: true,
    gstin: true,
    shipperAddress: true,
    rtoAddress: false,
    sellerBrandName: true,
    brandLogo: true,
  },
  product_info: {
    itemName: true,
    productCost: false,
    productQuantity: true,
    skuCode: true,
    dimension: true,
    deadWeight: true,
    otherCharges: true,
  },
  brand_logo: null,
  powered_by: PLATFORM_BRAND_NAME,
  created_at: new Date(),
  updated_at: new Date(),
}

const enforcePlatformBranding = <T extends Record<string, any>>(prefs: T) => ({
  ...prefs,
  brand_logo: null,
  powered_by: PLATFORM_BRAND_NAME,
})

export const labelPreferencesService = {
  async getByUser(userId: string) {
    const [prefs] = await db
      .select()
      .from(labelPreferences)
      .where(eq(labelPreferences.user_id, userId))

    if (prefs) {
      return enforcePlatformBranding(prefs)
    }

    // Fallback defaults
    return {
      id: null,
      user_id: userId,
      ...DEFAULT_PREFERENCES,
    }
  },

  async createOrUpdate(userId: string, data: any) {
    const safeData = enforcePlatformBranding(data || {})
    const [existing] = await db
      .select()
      .from(labelPreferences)
      .where(eq(labelPreferences.user_id, userId))

    if (existing) {
      const [updated] = await db
        .update(labelPreferences)
        .set({ ...safeData, updated_at: new Date() })
        .where(eq(labelPreferences.user_id, userId))
        .returning()
      return enforcePlatformBranding(updated)
    } else {
      const [created] = await db
        .insert(labelPreferences)
        .values({ user_id: userId, ...DEFAULT_PREFERENCES, ...safeData })
        .returning()
      return enforcePlatformBranding(created)
    }
  },
}

