import { Request, Response } from 'express'
import { db } from '../../models/client'
import { courierCredentials } from '../../models/schema/courierCredentials'
import { shadowfaxProductionTokenValues } from '../../models/services/couriers/shadowfaxCredentials'
import { ShadowfaxError } from '../../models/services/couriers/shadowfax.service'

export async function updateShadowfaxProductionToken(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const values = shadowfaxProductionTokenValues(req.body)
    await db.insert(courierCredentials).values(values).onConflictDoUpdate({
      target: courierCredentials.provider,
      set: { apiBase: values.apiBase, apiKey: values.apiKey, updatedAt: new Date() },
    })
    // Never return the token, its fragments, or a raw database/HTTP error.
    return res.json({ success: true, data: { provider: 'shadowfax', hasApiToken: true, environment: 'production' },
      message: 'Shadowfax production token saved. Booking activation is unchanged.' })
  } catch (error) {
    return res.status(error instanceof ShadowfaxError ? error.statusCode : 500).json({
      success: false, message: error instanceof ShadowfaxError ? error.message : 'Could not save the Shadowfax production token.',
    })
  }
}
