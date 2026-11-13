import { eq } from 'drizzle-orm'
import { db } from '../client'
import { labelPreferences } from '../schema/labelPreferences'

const PLATFORM_BRAND_NAME = 'ChoiceMee Courier'

export const DEFAULT_PREFERENCES = {
  printer_type: 'thermal',
  label_sheet_layout: 'a4_single',
  char_limit: 25,
  max_items: 3,
  note_enabled: false,
  label_note: '',
  order_info: {
    orderId: true,
    invoiceNumber: true,
    orderDate: false,
    invoiceDate: false,
    orderBarcode: true,
    invoiceBarcode: true,
    customerPhone: true,
    rtoRoutingCode: true,
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
  label_sheet_layout: prefs?.label_sheet_layout === 'a4_4up' ? 'a4_4up' : 'a4_single',
  note_enabled: prefs?.note_enabled === true,
  label_note: String(prefs?.label_note ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 240),
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
    const allowed = ['printer_type', 'label_sheet_layout', 'char_limit', 'max_items', 'order_info', 'shipper_info', 'product_info', 'note_enabled', 'label_note']
    const safeData = enforcePlatformBranding(Object.fromEntries(allowed.filter((key) => data?.[key] !== undefined).map((key) => [key, data[key]])))
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

