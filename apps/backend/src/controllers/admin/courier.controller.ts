import { and, eq, inArray, sql } from 'drizzle-orm'
import { Request, Response } from 'express'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { db } from '../../models/client'
import {
  deleteCourierService,
  deleteShippingRate,
  getShippingRates,
  ShippingRateUpdatePayload,
  updateShippingRate,
  upsertShippingRate,
} from '../../models/services/courierIntegration.service'
import {
  getDeliveryOneCourierCatalog,
  type DeliveryOneCourierCatalogItem,
} from '../../models/services/deliveryOneCourierCatalog.service'
import { DeliveryOneService } from '../../models/services/couriers/deliveryone.service'
import { fetchAvailableCouriersWithRatesAdmin } from '../../models/services/shiprocket.service'
import { courier_credentials } from '../../models/schema/courierCredentials'
import { couriers } from '../../models/schema/couriers'
import { getAllZones } from '../../models/services/zone.service'
import {
  VISIBLE_SERVICE_PROVIDERS,
  isVisibleServiceProvider,
  normalizeServiceProviderKey,
  visibleServiceProviderList,
} from '../../utils/courierProviders'
import {
  DELHIVERY_ALLOWED_COURIER_IDS,
  getDelhiveryCourierDisplayName,
} from '../../utils/delhiveryCourier'
import { extractCodChargeBasisFromBody, extractOrderAmountFromBody } from '../../utils/orderAmount'

export interface ShippingRateFilters {
  courier_name?: string[]
  mode?: string
  min_weight?: number
  plan_id?: string
  business_type?: 'b2b' | 'b2c'
  zone?: string[]
}

const normalizeCourierListText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()

const isDelhiveryListProvider = (value: unknown) => {
  const normalized = normalizeServiceProviderKey(value)
  return normalized === 'deliveryone'
}

const normalizeCourierListToken = (value: unknown) =>
  normalizeCourierListText(value).replace(/[\s_-]+/g, '')

const isDelhiveryCatalogRow = (row: { id: number; name: string }) => {
  return DELHIVERY_ALLOWED_COURIER_IDS.includes(Number(row.id))
}

const getCanonicalDelhiveryCouriers = async (filters: {
  search?: unknown
  serviceProvider?: unknown
  businessType?: unknown
} = {}) => {
  const providerFilter = String(filters.serviceProvider ?? '').trim()
  if (providerFilter && !isDelhiveryListProvider(providerFilter)) return []

  const requestedBusinessType = normalizeCourierListText(filters.businessType)

  const dbRows = await db
    .select({
      id: couriers.id,
      name: couriers.name,
      serviceProvider: couriers.serviceProvider,
      isEnabled: couriers.isEnabled,
      businessType: couriers.businessType,
      createdAt: couriers.createdAt,
      updatedAt: couriers.updatedAt,
    })
    .from(couriers)
    .where(
      and(
        eq(couriers.isEnabled, true),
        inArray(couriers.serviceProvider, [...VISIBLE_SERVICE_PROVIDERS]),
      ),
    )

  const dbCatalogRows: DeliveryOneCourierCatalogItem[] = dbRows.map((row) => ({
    id: row.id,
    name: row.name,
    displayName: row.name,
    serviceProvider: row.serviceProvider,
    service_provider: row.serviceProvider,
    isEnabled: row.isEnabled,
    businessType: Array.isArray(row.businessType)
      ? row.businessType.filter((type): type is 'b2c' | 'b2b' => type === 'b2c' || type === 'b2b')
      : [],
    mode: '',
    shipping_mode: '',
    shippingMode: '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
  const sourceRows: DeliveryOneCourierCatalogItem[] = dbCatalogRows.length
    ? dbCatalogRows
    : getDeliveryOneCourierCatalog()
  const legacyIds = new Set<number>(DELHIVERY_ALLOWED_COURIER_IDS)
  const deduped = new Map<string, DeliveryOneCourierCatalogItem>()

  sourceRows
    .filter(isDelhiveryCatalogRow)
    .sort((left, right) => {
      const leftLegacy = legacyIds.has(Number(left.id)) ? 1 : 0
      const rightLegacy = legacyIds.has(Number(right.id)) ? 1 : 0
      return rightLegacy - leftLegacy || Number(left.id) - Number(right.id)
    })
    .forEach((row) => {
      const displayName = getDelhiveryCourierDisplayName(row.name || row.id)
      const key = normalizeCourierListToken(displayName)
      if (deduped.has(key)) return

      const mode = displayName.toLowerCase().includes('express') ? 'air' : 'surface'
      deduped.set(key, {
        ...row,
        name: displayName,
        displayName,
        serviceProvider: 'deliveryone',
        service_provider: 'deliveryone',
        mode,
        shipping_mode: mode,
        shippingMode: mode === 'air' ? 'Express' : 'Surface',
      })
    })

  getDeliveryOneCourierCatalog().forEach((courier) => {
    const key = normalizeCourierListToken(courier.displayName)
    if (!deduped.has(key)) deduped.set(key, courier)
  })

  const list = Array.from(deduped.values()).filter((courier) => {
    const courierBusinessTypes = Array.isArray(courier.businessType)
      ? courier.businessType.map(String)
      : []

    if (
      (requestedBusinessType === 'b2c' || requestedBusinessType === 'b2b') &&
      !courierBusinessTypes.includes(requestedBusinessType)
    ) {
      return false
    }

    const search = normalizeCourierListText(filters.search)
    if (!search) return true

    return (
      String(courier.id).includes(search) ||
      normalizeCourierListText(courier.name).includes(search) ||
      normalizeCourierListText(courier.displayName).includes(search)
    )
  })

  return list
}

export const fetchAvailableCouriersForAdmin = async (req: Request, res: Response) => {
  try {
    const {
      origin,
      destination,
      payment_type,
      order_amount,
      cod_charge_basis,
      codChargeBasis,
      weight,
      length,
      breadth,
      height,
      shipment_type,
      plan_id,
      isCalculator,
      context,
    } = req.body
    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'pickupPincode and deliveryPincode are required',
      })
    }

    const orderAmountResult = extractOrderAmountFromBody(req.body)
    const codChargeBasisResult = extractCodChargeBasisFromBody(req.body, orderAmountResult.value)
    if (orderAmountResult.invalid || codChargeBasisResult.invalid) {
      return res.status(400).json({
        success: false,
        error: orderAmountResult.invalid
          ? 'order_amount must be a non-negative number'
          : 'cod_charge_basis must be a non-negative number',
      })
    }

    const couriers = await fetchAvailableCouriersWithRatesAdmin(
      {
        origin: Number(origin),
        destination: Number(destination),
        payment_type: payment_type,
        order_amount: orderAmountResult.value ?? order_amount,
        cod_charge_basis: codChargeBasisResult.value ?? cod_charge_basis ?? codChargeBasis,
        shipment_type: shipment_type,
        weight: Number(weight),
        length: Number(length),
        breadth: Number(breadth),
        height: Number(height),
        isCalculator: isCalculator === true || context === 'rate_calculator',
      },
      plan_id,
    )

    return res.json({ success: true, data: couriers ?? [] })
  } catch (err: any) {
    console.error('Error fetching couriers:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
}

export const getShippingRatesController = async (req: Request, res: Response) => {
  try {
    let courierNames: string[] = []

    const rawCourierNames = req.query['courier_name[]'] ?? req.query.courier_name
    const rawZones = req.query['zone[]'] ?? req.query.zone

    if (Array.isArray(rawCourierNames)) {
      courierNames = rawCourierNames.flat().filter(Boolean).map(String)
    } else if (typeof rawCourierNames === 'string') {
      courierNames = [rawCourierNames]
    }

    const zonesFilter = Array.isArray(rawZones)
      ? rawZones.flat().filter(Boolean).map(String)
      : typeof rawZones === 'string'
        ? [rawZones]
        : []

    const requestedBusinessType = (req.query.businessType as string | undefined)
      ?.trim()
      .toLowerCase() as 'b2b' | 'b2c' | undefined

    const filters: ShippingRateFilters = {
      courier_name: courierNames.length ? courierNames : undefined,
      mode: req.query.mode as string | undefined,
      min_weight:
        requestedBusinessType === 'b2c'
          ? undefined
          : req.query.min_weight
            ? Number(req.query.min_weight)
            : undefined,
      plan_id: req.query.planId as string | undefined,
      business_type: requestedBusinessType,
      zone: zonesFilter.length ? zonesFilter : undefined,
    }

    const rates = await getShippingRates(filters)
    res.json({ success: true, data: rates })
  } catch (err) {
    console.error('Error fetching shipping rates:', err)
    res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}

export const getAllCouriersController = async (req: Request, res: Response) => {
  try {
    const courierList = await getCanonicalDelhiveryCouriers()

    res.json({ success: true, data: courierList })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false })
  }
}

export const getAllCouriersListController = async (req: Request, res: Response) => {
  try {
    const { search, serviceProvider, businessType } = req.query

    const courierList = await getCanonicalDelhiveryCouriers({
      search,
      serviceProvider,
      businessType,
    })

    res.json({ success: true, data: courierList })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to fetch couriers' })
  }
}

export const updateCourierStatusController = async (req: Request, res: Response) => {
  const { id } = req.params
  const { serviceProvider, isEnabled, businessType } = req.body

  try {
    if (!serviceProvider) {
      return res.status(400).json({
        success: false,
        message: 'serviceProvider is required',
      })
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    }

    // Update isEnabled if provided
    if (typeof isEnabled === 'boolean') {
      updateData.isEnabled = isEnabled
    }

    // Update businessType if provided
    if (businessType && Array.isArray(businessType) && businessType.length > 0) {
      // Validate businessType values
      const validTypes = businessType.filter((type) => type === 'b2c' || type === 'b2b')
      if (validTypes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'businessType must contain at least one valid value: "b2c" or "b2b"',
        })
      }
      updateData.businessType = validTypes
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 1) {
      // Only updatedAt was added, nothing to update
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update. Provide isEnabled and/or businessType',
      })
    }

    const normalizedServiceProvider = normalizeServiceProviderKey(serviceProvider)
    if (!isVisibleServiceProvider(normalizedServiceProvider)) {
      return res.status(400).json({
        success: false,
        message: `Only these providers are supported: ${visibleServiceProviderList()}`,
      })
    }

    const updated = await db
      .update(couriers)
      .set(updateData)
      .where(and(eq(couriers.id, Number(id)), eq(couriers.serviceProvider, normalizedServiceProvider)))
      .returning()

    if (!updated.length) {
      return res.status(404).json({ success: false, message: 'Courier not found' })
    }

    res.json({ success: true, data: updated[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update courier' })
  }
}

export const getServiceProvidersController = async (req: Request, res: Response) => {
  try {
    // Only expose the main integrated service providers in the enable/disable UI
    const allowedProviders = [...VISIBLE_SERVICE_PROVIDERS]

    const rows = await db
      .select({
        serviceProvider: couriers.serviceProvider,
        totalCouriers: sql<number>`count(*)`,
        enabledCouriers: sql<number>`sum(case when ${couriers.isEnabled} then 1 else 0 end)`,
      })
      .from(couriers)
      .where(
        and(
          inArray(couriers.serviceProvider, allowedProviders),
        ),
      )
      .groupBy(couriers.serviceProvider)
      .orderBy(couriers.serviceProvider)

    const byProvider = new Map(
      rows.map((row) => [
        row.serviceProvider,
        {
          serviceProvider: row.serviceProvider,
          totalCouriers: Number(row.totalCouriers || 0),
          enabledCouriers: Number(row.enabledCouriers || 0),
          isEnabled: Number(row.enabledCouriers || 0) > 0,
        },
      ]),
    )

    // Ensure allowed providers are always visible in admin UI,
    // even when no rows exist in couriers table yet.
    const providers = allowedProviders.map((provider) => ({
      serviceProvider: provider,
      totalCouriers: byProvider.get(provider)?.totalCouriers ?? 0,
      enabledCouriers: byProvider.get(provider)?.enabledCouriers ?? 0,
      isEnabled: byProvider.get(provider)?.isEnabled ?? false,
    }))

    res.json({ success: true, data: providers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to fetch service providers' })
  }
}

export const updateServiceProviderStatusController = async (req: Request, res: Response) => {
  const { serviceProvider } = req.params
  const { isEnabled } = req.body

  try {
    const allowedProviders = [...VISIBLE_SERVICE_PROVIDERS]

    if (!serviceProvider || typeof isEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'serviceProvider (param) and boolean isEnabled (body) are required',
      })
    }
    const normalizedProvider = normalizeServiceProviderKey(serviceProvider)
    if (!allowedProviders.includes(normalizedProvider as any)) {
      return res.status(400).json({
        success: false,
        message: `Only these providers are supported: ${visibleServiceProviderList()}`,
      })
    }

    const updated = await db
      .update(couriers)
      .set({
        isEnabled,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(couriers.serviceProvider, normalizedProvider),
        ),
      )
      .returning()

    if (!updated.length) {
      return res.status(404).json({ success: false, message: 'No couriers found for provider' })
    }

    res.json({
      success: true,
      data: {
        serviceProvider: normalizedProvider,
        isEnabled,
        affectedCouriers: updated.length,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update service provider status' })
  }
}

export const getCourierCredentialsController = async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        provider: courier_credentials.provider,
        apiBase: courier_credentials.apiBase,
        clientName: courier_credentials.clientName,
        apiKey: courier_credentials.apiKey,
        clientId: courier_credentials.clientId,
        username: courier_credentials.username,
        password: courier_credentials.password,
        webhookSecret: courier_credentials.webhookSecret,
      })
      .from(courier_credentials)
      .where(
        inArray(courier_credentials.provider, ['delhivery', 'deliveryone']),
      )

    const defaults = {
      deliveryOne: {
        provider: 'deliveryone',
        apiBase: 'https://track.delhivery.com',
        clientId: '',
        username: '',
        hasApiKey: false,
        apiKeyMasked: '',
        hasPassword: false,
        hasWebhookSecret: false,
      },
    }

    const activeCredential =
      rows.find((row) => String(row.provider || '').toLowerCase() === 'deliveryone') ||
      rows.find((row) => String(row.provider || '').toLowerCase() === 'delhivery')
    const apiKey = activeCredential?.apiKey || ''
    const data = {
      ...defaults,
      ...(activeCredential
        ? {
            deliveryOne: {
              provider: 'deliveryone',
              apiBase: activeCredential.apiBase || 'https://track.delhivery.com',
              clientId: activeCredential.clientId || '',
              username: activeCredential.username || '',
              hasApiKey: Boolean(apiKey.trim()),
              apiKeyMasked: apiKey
                ? `${apiKey.slice(0, 4)}${'*'.repeat(Math.max(apiKey.length - 8, 0))}${apiKey.slice(-4)}`
                : '',
              hasPassword: Boolean((activeCredential.password || '').trim()),
              hasWebhookSecret: Boolean((activeCredential.webhookSecret || '').trim()),
            },
          }
        : {}),
    }

    res.json({
      success: true,
      data,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to fetch courier credentials' })
  }
}

export const updateDeliveryOneCredentialsController = async (req: Request, res: Response) => {
  const { apiBase, clientId, username, password, apiKey, webhookSecret } = req.body || {}
  const credentialsProvider = 'deliveryone'

  try {
    const nextApiBase = typeof apiBase === 'string' ? apiBase.trim() : undefined
    const nextClientId = typeof clientId === 'string' ? clientId.trim() : undefined
    const nextUsername = typeof username === 'string' ? username.trim() : undefined
    const nextPassword = typeof password === 'string' ? password.trim() : undefined
    const nextApiKey = typeof apiKey === 'string' ? apiKey.trim() : undefined
    const nextWebhookSecret =
      typeof webhookSecret === 'string' ? webhookSecret.trim() : undefined
    const hasPassword = typeof nextPassword === 'string' && nextPassword.length > 0
    const hasApiKey = typeof nextApiKey === 'string' && nextApiKey.length > 0
    const hasWebhookSecret =
      typeof nextWebhookSecret === 'string' && nextWebhookSecret.length > 0

    const [existing] = await db
      .select({ id: courier_credentials.id })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, credentialsProvider))
      .limit(1)

    if (existing) {
      const updatePayload: Record<string, any> = {
        updatedAt: new Date(),
      }
      if (nextApiBase !== undefined) {
        updatePayload.apiBase = nextApiBase || 'https://track.delhivery.com'
      }
      if (nextClientId !== undefined) {
        updatePayload.clientId = nextClientId
      }
      if (nextUsername !== undefined) {
        updatePayload.username = nextUsername
      }
      if (hasPassword) {
        updatePayload.password = nextPassword
      }
      if (hasApiKey) {
        updatePayload.apiKey = nextApiKey
      }
      if (hasWebhookSecret) {
        updatePayload.webhookSecret = nextWebhookSecret
      }

      await db
        .update(courier_credentials)
        .set(updatePayload)
        .where(eq(courier_credentials.provider, credentialsProvider))
    } else {
      await db.insert(courier_credentials).values({
        provider: credentialsProvider,
        apiBase: nextApiBase || 'https://track.delhivery.com',
        clientName: '',
        apiKey: hasApiKey ? nextApiKey : '',
        clientId: nextClientId || '',
        username: nextUsername || '',
        password: hasPassword ? nextPassword : '',
        webhookSecret: hasWebhookSecret ? nextWebhookSecret : '',
      })
    }

    DeliveryOneService.clearCachedConfig()

    const [saved] = await db
      .select({
        apiBase: courier_credentials.apiBase,
        clientId: courier_credentials.clientId,
        username: courier_credentials.username,
        password: courier_credentials.password,
        apiKey: courier_credentials.apiKey,
        webhookSecret: courier_credentials.webhookSecret,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, credentialsProvider))
      .limit(1)

    res.json({
      success: true,
      message: 'Delhivery credentials updated successfully',
      data: {
        provider: credentialsProvider,
        apiBase: saved?.apiBase || 'https://track.delhivery.com',
        clientId: saved?.clientId || '',
        username: saved?.username || '',
        hasPassword: Boolean((saved?.password || '').trim()),
        hasApiKey: Boolean((saved?.apiKey || '').trim()),
        hasWebhookSecret: Boolean((saved?.webhookSecret || '').trim()),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update Delhivery credentials' })
  }
}

export const fetchDeliveryOneWaybillsController = async (req: Request, res: Response) => {
  try {
    const rawCount = req.method === 'GET' ? req.query.count : req.body?.count
    const count = rawCount === undefined ? 1 : Number(rawCount)
    const result = await new DeliveryOneService().fetchWaybills(count)

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to fetch Delhivery waybills:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to fetch Delhivery waybills',
    })
  }
}

export const checkDeliveryOnePincodeServiceabilityController = async (
  req: Request,
  res: Response,
) => {
  try {
    const source = req.method === 'GET' ? req.query : req.body
    const pincode =
      req.params?.pincode ||
      (source as any)?.pincode ||
      (source as any)?.pin ||
      (source as any)?.filter_codes
    const originPincode =
      (source as any)?.origin_pincode ||
      (source as any)?.originPincode ||
      (source as any)?.origin
    const destinationPincode =
      (source as any)?.destination_pincode ||
      (source as any)?.destinationPincode ||
      (source as any)?.destination
    const paymentType =
      (source as any)?.payment_type || (source as any)?.paymentType || (source as any)?.pt

    const deliveryOne = new DeliveryOneService()
    const result =
      originPincode && destinationPincode
        ? await deliveryOne.checkPairServiceability({
            originPincode,
            destinationPincode,
            paymentType,
          })
        : await deliveryOne.checkPincodeServiceability(pincode)

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to check Delhivery pincode serviceability:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to check Delhivery pincode serviceability',
    })
  }
}

export const createDeliveryOneShipmentController = async (req: Request, res: Response) => {
  try {
    const result = await new DeliveryOneService().createShipment(req.body || {})

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to create Delhivery shipment:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to create Delhivery shipment',
    })
  }
}

export const editDeliveryOneShipmentController = async (req: Request, res: Response) => {
  try {
    const result = await new DeliveryOneService().editShipment(req.body || {})

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to edit Delhivery shipment:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to edit Delhivery shipment',
    })
  }
}

export const cancelDeliveryOneShipmentController = async (req: Request, res: Response) => {
  try {
    const waybill = req.body?.waybill || req.params?.waybill
    const result = await new DeliveryOneService().cancelShipment(waybill)

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to cancel Delhivery shipment:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to cancel Delhivery shipment',
    })
  }
}

export const updateDeliveryOneEWaybillController = async (req: Request, res: Response) => {
  try {
    const result = await new DeliveryOneService().updateEWaybill({
      ...(req.body || {}),
      waybill: req.body?.waybill || req.params?.waybill,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to update Delhivery e-waybill:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to update Delhivery e-waybill',
    })
  }
}

export const trackDeliveryOneShipmentController = async (req: Request, res: Response) => {
  try {
    const result = await new DeliveryOneService().trackShipment({
      waybill: req.params?.waybill || req.query?.waybill || req.body?.waybill,
      ref_ids: req.query?.ref_ids || req.query?.refIds || req.body?.ref_ids || req.body?.refIds,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to track Delhivery shipment:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to track Delhivery shipment',
    })
  }
}

export const getDeliveryOneExpectedTatController = async (req: Request, res: Response) => {
  try {
    const source = req.method === 'GET' ? req.query : req.body
    const result = await new DeliveryOneService().getExpectedTat({
      ...(source || {}),
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to fetch Delhivery expected TAT:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to fetch Delhivery expected TAT',
    })
  }
}

export const calculateDeliveryOneShippingCostController = async (
  req: Request,
  res: Response,
) => {
  try {
    const source = req.method === 'GET' ? req.query : req.body
    const result = await new DeliveryOneService().calculateShippingCost({
      ...(source || {}),
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to calculate Delhivery shipping cost:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to calculate Delhivery shipping cost',
    })
  }
}

export const downloadDeliveryOneDocumentController = async (req: Request, res: Response) => {
  try {
    const source = req.method === 'GET' ? req.query : req.body
    const result = await new DeliveryOneService().downloadDocument({
      ...(source || {}),
      waybill: req.params?.waybill || (source as any)?.waybill,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to download Delhivery document:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to download Delhivery document',
    })
  }
}

export const submitDeliveryOneNdrActionController = async (req: Request, res: Response) => {
  try {
    const result = await new DeliveryOneService().submitNdrAction(req.body || {})

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to submit Delhivery NDR action:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to submit Delhivery NDR action',
    })
  }
}

export const getDeliveryOneNdrStatusController = async (req: Request, res: Response) => {
  try {
    const rawVerbose = req.query?.verbose ?? req.body?.verbose
    const verbose =
      rawVerbose === undefined
        ? true
        : ['1', 'true', 'yes', 'y'].includes(String(rawVerbose).trim().toLowerCase())
    const result = await new DeliveryOneService().getNdrStatus(
      String(req.params?.uplId || req.query?.uplId || req.body?.uplId || ''),
      verbose,
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to fetch Delhivery NDR status:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to fetch Delhivery NDR status',
    })
  }
}

export const generateDeliveryOneLabelController = async (req: Request, res: Response) => {
  try {
    const source = req.method === 'GET' ? req.query : req.body
    const result = await new DeliveryOneService().generateLabel({
      ...(source || {}),
      waybill: req.params?.waybill || (source as any)?.waybill || (source as any)?.wbns,
      pdf: (source as any)?.pdf ?? true,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to generate Delhivery shipping label:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to generate Delhivery shipping label',
    })
  }
}

export const createDeliveryOnePickupRequestController = async (
  req: Request,
  res: Response,
) => {
  try {
    const result = await new DeliveryOneService().createPickupRequest(req.body || {})

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to create Delhivery pickup request:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to create Delhivery pickup request',
    })
  }
}

export const createDeliveryOneWarehouseController = async (req: Request, res: Response) => {
  try {
    const result = await new DeliveryOneService().createWarehouse(req.body || {})

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to create Delhivery warehouse:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to create Delhivery warehouse',
    })
  }
}

export const updateDeliveryOneWarehouseController = async (req: Request, res: Response) => {
  try {
    const result = await new DeliveryOneService().updateWarehouse({
      ...(req.body || {}),
      name: req.body?.name ?? req.params?.name,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('Failed to update Delhivery warehouse:', err?.message || err)
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'Failed to update Delhivery warehouse',
    })
  }
}

export interface RateType {
  forward?: string | number
  rto?: string | number
}

// Utility: convert numbers to string for decimal fields
export const numericToString = (val: string | number | null | undefined): string | null => {
  if (val === null || val === undefined || val === '') return null
  return String(val)
}

// ---------------- Controller ----------------
export const updateShippingRateController = async (req: Request, res: Response) => {
  try {
    const courierId = Number(req.params.id) // courier_id from params
    let planId: string | undefined = req.params.planId // plan_id from params

    // Fallback: try to get planId from query or body if not in params
    if (!planId || planId === 'undefined') {
      planId = (req.query.planId as string) || (req.body.planId as string) || undefined
    }

    if (!courierId || isNaN(courierId)) {
      return res.status(400).json({ success: false, message: 'Invalid courier ID' })
    }

    if (!planId || planId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing plan ID. Please ensure a plan is selected.',
      })
    }

    const updates: ShippingRateUpdatePayload = req.body

    console.log(`[updateShippingRateController] courierId: ${courierId}, planId: ${planId}`)

    const updated = await updateShippingRate(courierId, updates, planId)
    if (!updated) return res.status(404).json({ success: false, message: 'Rate card not found' })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.log('Error updating shipping rate:', err)
    const statusCode = isRateUpdateValidationError(err) ? 400 : 500
    res.status(statusCode).json({
      success: false,
      message: isRateUpdateValidationError(err)
        ? String((err as any)?.message || 'Invalid rate-card update')
        : 'Internal Server Error',
    })
  }
}

type CSVRow = Record<string, string | undefined>

const parseSlabJsonCell = (value?: string) => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const parseCodSlabJsonCell = (value?: string) => parseSlabJsonCell(value)

const zoneColumnBase = (zone: { code?: string | null; name?: string | null }) => {
  const code = String(zone.code || '').trim()
  const name = String(zone.name || '').trim()
  return [
    code && name ? `${code} - ${name}` : '',
    code,
    name,
  ].filter(Boolean)
}

const readZoneCell = (
  row: CSVRow,
  zone: { code?: string | null; name?: string | null },
  suffix: string,
) => {
  for (const base of zoneColumnBase(zone)) {
    const value = row[`${base} (${suffix})`]
    if (value !== undefined && value !== null && value !== '') return value
  }

  return undefined
}

const isSlabValidationError = (err: unknown) =>
  /slab|overlap|extra_rate|extra_weight_unit|charge_type|charge_value/i.test(
    String((err as any)?.message || err || ''),
  )

const isRateUpdateValidationError = (err: unknown) =>
  isSlabValidationError(err) ||
  /businessType|business type|plan ID|courierId|courier_name|required|shipping mode/i.test(
    String((err as any)?.message || err || ''),
  )

const isImportFormatError = (err: unknown) =>
  /csv|excel|sheet|format/i.test(String((err as any)?.message || err || ''))

export const parseShippingRateImportRows = (file: any): CSVRow[] => {
  const filename = String(file?.originalname || '').toLowerCase()
  const mimetype = String(file?.mimetype || '').toLowerCase()
  const isExcel =
    filename.endsWith('.xlsx') ||
    filename.endsWith('.xls') ||
    mimetype.includes('spreadsheet') ||
    mimetype.includes('excel')

  if (isExcel) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('Uploaded Excel file does not contain any sheets')
    }

    const rows = XLSX.utils.sheet_to_json<CSVRow>(workbook.Sheets[firstSheetName], {
      defval: '',
      raw: false,
    })
    return rows
  }

  const csvContent = file.buffer.toString('utf8')
  const { data, errors } = Papa.parse<CSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  })

  if (errors.length) {
    const error = new Error('Invalid CSV format') as Error & { details?: unknown }
    error.details = errors
    throw error
  }

  return data
}

export const importShippingRatesController = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    const { planId: plan_id, businessType: business_type } = req.query
    const normalizedBusinessType = String(business_type || '').trim().toLowerCase()
    if (!plan_id || !normalizedBusinessType) {
      return res.status(400).json({ success: false, message: 'Missing plan_id or business_type' })
    }
    if (normalizedBusinessType !== 'b2b' && normalizedBusinessType !== 'b2c') {
      return res.status(400).json({
        success: false,
        message: 'business_type must be either b2b or b2c',
      })
    }

    const data = parseShippingRateImportRows(req.file)

    const zonesList = await getAllZones(normalizedBusinessType)

    for (const row of data as CSVRow[]) {
      const courierId = row['Courier ID']
      const courierName = row['Courier Name']
      const serviceProvider = row['Service Provider']
      const minWeight = row['Min Weight']
      const mode = row['Mode'] || ''

      if (!courierId || !courierName) continue
      if (normalizedBusinessType === 'b2c' && !String(mode).trim()) {
        return res.status(400).json({
          success: false,
          message: `Mode is required for B2C rate import. Please set Mode as air or surface for courier ${courierName}.`,
        })
      }

      // Parse rates for each zone
      type RateItem = { zone_id: string; type: 'forward' | 'rto'; rate: number }

      const rates: RateItem[] = zonesList.flatMap((zone): RateItem[] => {
        const forwardValue =
          normalizedBusinessType === 'b2b'
            ? readZoneCell(row, zone, 'Per Kg Forward') ?? readZoneCell(row, zone, 'Forward')
            : readZoneCell(row, zone, 'Forward')
        const rtoValue =
          normalizedBusinessType === 'b2b'
            ? readZoneCell(row, zone, 'Per Kg RTO') ?? readZoneCell(row, zone, 'RTO')
            : readZoneCell(row, zone, 'RTO')
        const zoneRates: RateItem[] = []

        if (forwardValue !== undefined) {
          const forwardRate = Number(forwardValue)
          if (Number.isFinite(forwardRate)) {
            zoneRates.push({ zone_id: zone.id, type: 'forward', rate: forwardRate })
          }
        }

        if (rtoValue !== undefined) {
          const rtoRate = Number(rtoValue)
          if (Number.isFinite(rtoRate)) {
            zoneRates.push({ zone_id: zone.id, type: 'rto', rate: rtoRate })
          }
        }

        return zoneRates
      })

      const zoneSlabs: Record<string, { forward?: any[]; rto?: any[] }> = {}
      if (normalizedBusinessType === 'b2c') {
        for (const zone of zonesList) {
          const forwardSlabs = parseSlabJsonCell(readZoneCell(row, zone, 'Forward Slabs'))
          const rtoSlabs = parseSlabJsonCell(readZoneCell(row, zone, 'RTO Slabs'))
          if (forwardSlabs.length || rtoSlabs.length) {
            zoneSlabs[zone.id] = {}
            if (forwardSlabs.length) zoneSlabs[zone.id].forward = forwardSlabs
            if (rtoSlabs.length) zoneSlabs[zone.id].rto = rtoSlabs
          }
        }
      }

      const codCharges = row['COD Charges'] ? Number(row['COD Charges']) : null
      const codPercent = row['COD Percent'] ? Number(row['COD Percent']) : null
      const codSlabs =
        normalizedBusinessType === 'b2c' ? parseCodSlabJsonCell(row['COD Slabs']) : undefined
      const otherCharges = row['Other Charges'] ? Number(row['Other Charges']) : null

      // ✅ skip rows without mode, courier info, or any charges/rates
      const hasData =
        mode ||
        codCharges !== null ||
        codPercent !== null ||
        otherCharges !== null ||
        rates.length > 0 ||
        Object.keys(zoneSlabs).length > 0 ||
        Boolean(codSlabs?.length)

      if (!hasData) continue

      await upsertShippingRate({
        courier_id: courierId,
        courier_name: courierName,
        service_provider: serviceProvider,
        plan_id: plan_id as string,
        min_weight: minWeight,
        business_type: normalizedBusinessType,
        mode,
        cod_charges: codCharges,
        cod_percent: codPercent,
        other_charges: otherCharges,
        rates,
        zone_slabs: normalizedBusinessType === 'b2c' ? zoneSlabs : undefined,
        cod_slabs: codSlabs,
      })
    }

    res.json({ success: true, message: 'Shipping rates imported successfully' })
  } catch (err) {
    console.error('Error importing shipping rates:', err)
    const statusCode = isSlabValidationError(err) || isImportFormatError(err) ? 400 : 500
    res.status(statusCode).json({
      success: false,
      message: isSlabValidationError(err) || isImportFormatError(err)
        ? String((err as any)?.message || 'Invalid slab configuration')
        : 'Internal Server Error',
    })
  }
}

export const deleteShippingRateController = async (req: Request, res: Response) => {
  try {
    const courierId = Number(req.params.id)
    const planId = req.params.planId
    const businessType = req.query.businessType as 'b2b' | 'b2c'
    const zoneId = req.query.zoneId as string | undefined
    const serviceProvider = req.query.serviceProvider as string | undefined
    const mode = req.query.mode as string | undefined

    if (!courierId || !planId || !businessType) {
      return res
        .status(400)
        .json({ success: false, message: 'courierId, planId and businessType are required' })
    }

    const deleted = await deleteShippingRate(
      courierId,
      planId,
      businessType,
      zoneId,
      serviceProvider,
      mode,
    )

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'No matching rate found' })
    }

    res.json({ success: true, message: 'Rate(s) deleted successfully', data: deleted })
  } catch (err) {
    console.error('Error deleting shipping rate:', err)
    res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}

export const deleteCourierController = async (req: Request, res: Response) => {
  const { id } = req.params
  const { serviceProvider } = req.body

  try {
    if (!serviceProvider) {
      return res.status(400).json({ success: false, message: 'Service provider is required' })
    }
    await deleteCourierService(id, serviceProvider)
    res.json({ success: true, message: 'Courier deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to delete courier' })
  }
}
