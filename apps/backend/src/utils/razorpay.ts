import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import Razorpay from 'razorpay'

const env = process.env.NODE_ENV || 'development'
const backendRoot = path.resolve(__dirname, '../..')

// This module is imported before app.ts finishes loading dotenv, so it must
// hydrate Razorpay env itself. Load mode-specific env first, then base .env as
// a fallback; already-provided process env values still win.
dotenv.config({ path: path.join(backendRoot, `.env.${env}`) })
dotenv.config({ path: path.join(backendRoot, '.env') })

type RazorpayMode = 'test' | 'live'
export type RazorpayRuntimeMode = RazorpayMode

const configuredMode = process.env.RAZORPAY_MODE
export const razorpayMode: RazorpayMode =
  configuredMode === 'test' || configuredMode === 'live'
    ? configuredMode
    : process.env.NODE_ENV === 'production'
      ? 'live'
      : 'test'

const normalizeKeyId = (keyId: string) => keyId.trim().replace(/^rzp_tst_/, 'rzp_test_')

const CREDENTIALS: Record<RazorpayMode, { key_id: string; key_secret: string }> = {
  test: {
    key_id: normalizeKeyId(process.env.RAZORPAY_KEY_ID || ''),
    key_secret: process.env.RAZORPAY_KEY_SECRET?.trim() || '',
  },
  live: {
    key_id: normalizeKeyId(process.env.RAZORPAY_KEY_ID_PROD || ''),
    key_secret: process.env.RAZORPAY_KEY_SECRET_PROD?.trim() || '',
  },
}

export const isRazorpayConfigured = Boolean(
  CREDENTIALS[razorpayMode].key_id && CREDENTIALS[razorpayMode].key_secret,
)

if (!isRazorpayConfigured) {
  console.warn(
    `[Razorpay] Missing credentials for ${razorpayMode.toUpperCase()} mode. Wallet topups are disabled until env vars are set.`,
  )
}

export const razorpay = new Razorpay({
  key_id: CREDENTIALS[razorpayMode].key_id || 'disabled',
  key_secret: CREDENTIALS[razorpayMode].key_secret || 'disabled',
})

if (isRazorpayConfigured) {
  console.info(
    `[Razorpay] Initialised in ${razorpayMode.toUpperCase()} mode with key ${CREDENTIALS[razorpayMode].key_id}`,
  )
}

export const razorpayApi = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  auth: {
    username:
      razorpayMode === 'live'
        ? process.env.RAZORPAY_KEY_ID_PROD || 'disabled'
        : process.env.RAZORPAY_KEY_ID || 'disabled',
    password:
      razorpayMode === 'live'
        ? process.env.RAZORPAY_KEY_SECRET_PROD || 'disabled'
        : process.env.RAZORPAY_KEY_SECRET || 'disabled',
  },
})

export function getRazorpayKeyId() {
  return CREDENTIALS[razorpayMode].key_id
}

export function assertRazorpayConfigured() {
  if (!isRazorpayConfigured) {
    throw new Error(
      `Razorpay ${razorpayMode} credentials are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for test mode, or RAZORPAY_KEY_ID_PROD and RAZORPAY_KEY_SECRET_PROD for live mode.`,
    )
  }
}

export function verifyRazorpayPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string
  paymentId: string
  signature: string
}) {
  const expected = crypto
    .createHmac('sha256', CREDENTIALS[razorpayMode].key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(signature)
  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  )
}

export function isValidSig(body: string | Buffer, sig?: string, mode: RazorpayMode = razorpayMode) {
  if (!sig) return false

  const webhookSecret =
    mode === 'live'
      ? process.env.RAZORPAY_WEBHOOK_SECRET_PROD || ''
      : process.env.RAZORPAY_WEBHOOK_SECRET || ''

  if (!webhookSecret) return false

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(sig)
  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  )
}
