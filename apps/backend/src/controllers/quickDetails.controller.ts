import { Request, Response } from 'express'
import {
  approveQuickDetailService,
  generateQuickDetailLinkService,
  getQuickDetailLinkPublicService,
  listQuickDetailsService,
  rejectQuickDetailService,
  submitQuickDetailPublicService,
} from '../models/services/quickDetails.service'

const getErrorStatusCode = (error: any) =>
  typeof error?.statusCode === 'number' ? error.statusCode : 500

const getErrorMessage = (error: any, fallback: string) =>
  typeof error?.message === 'string' && error.message.trim() ? error.message : fallback

export const generateQuickDetailLinkController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub || req.userId
    const link = await generateQuickDetailLinkService(userId)
    res.status(201).json({ success: true, data: link })
  } catch (error: any) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error, 'Failed to generate quick details link.'),
    })
  }
}

export const listQuickDetailsController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub || req.userId
    const page = Number(req.query.page || 1)
    const limit = Number(req.query.limit || 20)
    const status = req.query.status ? String(req.query.status) : undefined
    const data = await listQuickDetailsService({ userId, page, limit, status: status as any })
    res.status(200).json({ success: true, ...data })
  } catch (error: any) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error, 'Failed to fetch quick details.'),
    })
  }
}

export const rejectQuickDetailController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub || req.userId
    const data = await rejectQuickDetailService(userId, req.params.id, req.body?.reason)
    res.status(200).json({ success: true, data, message: 'Quick details rejected.' })
  } catch (error: any) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error, 'Failed to reject quick details.'),
    })
  }
}

export const approveQuickDetailController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub || req.userId
    const data = await approveQuickDetailService(userId, req.params.id, req.body)
    res.status(200).json({
      success: true,
      data,
      message: 'Quick details approved and B2C draft order created.',
    })
  } catch (error: any) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error, 'Failed to approve quick details.'),
    })
  }
}

export const getQuickDetailPublicController = async (req: Request, res: Response) => {
  try {
    const data = await getQuickDetailLinkPublicService(req.params.token, req.params.storeSlug)
    res.status(200).json({ success: true, data })
  } catch (error: any) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error, 'Quick details link not found.'),
    })
  }
}

export const submitQuickDetailPublicController = async (req: Request, res: Response) => {
  try {
    const data = await submitQuickDetailPublicService(req.params.token, req.params.storeSlug, req.body)
    res.status(200).json({
      success: true,
      data,
      message: 'Shipment details submitted successfully.',
    })
  } catch (error: any) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error, 'Failed to submit shipment details.'),
    })
  }
}
