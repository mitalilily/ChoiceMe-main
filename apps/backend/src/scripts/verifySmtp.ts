import { sendSmtpTestEmail, sendVerificationEmail, verifyEmailTransport } from '../utils/emailSender'

const maskEmail = (email: string) => {
  const [localPart = '', domain = ''] = email.split('@')
  if (!localPart || !domain) return '[invalid-email]'

  const visibleLocal =
    localPart.length <= 2 ? `${localPart[0] ?? '*'}*` : `${localPart.slice(0, 2)}***`

  return `${visibleLocal}@${domain}`
}

async function main() {
  const verified = await verifyEmailTransport()
  console.log('[SMTP Verify] Connection verified', verified)

  const testTo = process.env.SMTP_TEST_TO?.trim()
  if (!testTo) {
    console.log('[SMTP Verify] SMTP_TEST_TO is not set, so no test email was sent.')
    return
  }

  if (process.env.SMTP_TEST_KIND?.trim().toLowerCase() === 'otp') {
    await sendVerificationEmail(testTo, process.env.SMTP_TEST_OTP?.trim() || '123456')
    console.log('[SMTP Verify] OTP test email sent', { to: maskEmail(testTo) })
    return
  }

  await sendSmtpTestEmail(testTo)
  console.log('[SMTP Verify] Test email sent', { to: maskEmail(testTo) })
}

main().catch((error) => {
  console.error('[SMTP Verify] Failed', error)
  process.exit(1)
})
