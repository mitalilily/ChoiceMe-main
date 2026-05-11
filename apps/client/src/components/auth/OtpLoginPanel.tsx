import { Box, FormControlLabel, Link, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useMemo, useState } from 'react'
import { FiArrowRight, FiMail } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth/AuthContext'
import { useRequestOtp, useVerifyOtp } from '../../hooks/useOTP'
import { TERMS_AND_CONDITIONS } from '../../utils/constants'
import CustomIconLoadingButton from '../UI/button/CustomLoadingButton'
import CustomCheckbox from '../UI/inputs/CustomCheckbox'
import CustomInput from '../UI/inputs/CustomInput'
import CustomModal from '../UI/modal/CustomModal'
import { toast } from '../UI/Toast'
import { getAuthErrorMessage } from './getAuthErrorMessage'
import AuthCodePreview from './AuthCodePreview'
import CodeInput from './CodeInput'
import { extractInlineCode } from './inlineCode'
import { brand } from '../../theme/brand'

interface OtpLoginPanelProps {
  showIntro?: boolean
  compactLogin?: boolean
}

const AUTH_NAVY = '#0D1B4D'
const AUTH_ORANGE = '#E86F00'

const loginButtonStyles = {
  width: '100%',
  minHeight: 58,
  borderRadius: '7px',
  background: AUTH_NAVY,
  color: '#FFFFFF',
  boxShadow: `0 10px 20px ${alpha(AUTH_NAVY, 0.28)}`,
  '&:hover': {
    background: '#071643',
    transform: 'translateY(-1px)',
  },
  '&:disabled': {
    background: AUTH_NAVY,
    color: '#FFFFFF',
    opacity: 1,
    boxShadow: `0 10px 20px ${alpha(AUTH_NAVY, 0.2)}`,
  },
}

export default function OtpLoginPanel({
  showIntro = true,
  compactLogin = false,
}: OtpLoginPanelProps) {
  const navigate = useNavigate()
  const { setTokens, setUserId } = useAuth()
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [email, setEmail] = useState(sessionStorage.getItem('activeEmail') ?? '')
  const [code, setCode] = useState('')
  const [termsChecked, setTermsChecked] = useState(false)
  const [inlineOtp, setInlineOtp] = useState('')
  const [error, setError] = useState('')
  const [openTerms, setOpenTerms] = useState(false)

  const { mutate: requestOtp, isPending: requesting } = useRequestOtp()
  const { mutate: verifyOtp, isPending: verifying } = useVerifyOtp()

  const emailError = useMemo(() => {
    if (!email) return 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
    return ''
  }, [email])

  const handleRequest = (event?: React.FormEvent) => {
    event?.preventDefault()

    if (emailError) {
      setError(emailError)
      return
    }

    if (!termsChecked) {
      toast.open({
        message: 'Accept the Terms and Conditions to continue.',
        severity: 'warning',
      })
      return
    }

    setError('')
    requestOtp(email.trim().toLowerCase(), {
      onSuccess: (response: any) => {
        const inlineCode = extractInlineCode(response)
        setInlineOtp(inlineCode)
        setStep('verify')
        setCode('')
        toast.open({
          message: inlineCode
            ? 'Verification code generated. Use the inline code preview below.'
            : 'Verification code sent to your email.',
          severity: 'success',
        })
      },
      onError: (err: any) => {
        setError(getAuthErrorMessage(err, 'OTP request failed'))
      },
    })
  }

  const handleVerify = (event?: React.FormEvent) => {
    event?.preventDefault()

    if (code.length !== 6) {
      setError('Enter the full 6-digit verification code.')
      return
    }

    setError('')
    verifyOtp(
      { email, otp: code },
      {
        onSuccess: ({ token, refreshToken, user }) => {
          sessionStorage.setItem('activeEmail', email.trim().toLowerCase())
          setUserId(user?.id)
          setTokens(token, refreshToken)
          navigate('/app', { replace: true })
        },
        onError: (err: any) => {
          setError(getAuthErrorMessage(err, 'OTP verification failed'))
        },
      },
    )
  }

  return (
    <Stack spacing={compactLogin ? 2 : 2.2}>
      {showIntro ? (
        <Stack spacing={0.8}>
          <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.18rem' }}>
            Continue with email OTP
          </Typography>
          <Typography sx={{ color: brand.inkSoft, lineHeight: 1.7, fontSize: '0.92rem' }}>
            Use your registered email for a quick passwordless login into your courier dashboard.
          </Typography>
        </Stack>
      ) : null}

      <AuthCodePreview
        title="OTP"
        code={inlineOtp}
      />

      {step === 'request' ? (
        <Box component="form" onSubmit={handleRequest}>
          <CustomInput
            type="email"
            label={compactLogin ? 'Username' : 'Work Email'}
            placeholder={compactLogin ? 'e.g., yourname@choice.mee' : ''}
            value={email}
            name="email"
            id="otp-email"
            onChange={(event) => {
              setEmail(event.target.value)
              setError('')
            }}
            error={Boolean(error || emailError) && Boolean(email)}
            helperText={error || (email ? emailError : '')}
            prefix={<FiMail color={compactLogin ? AUTH_NAVY : brand.ink} size={compactLogin ? 20 : 15} />}
            autoFocus
            required
            topMargin={false}
            authVariant={compactLogin ? 'reference' : undefined}
          />

          <FormControlLabel
            sx={{ mt: compactLogin ? 1 : 1.2, mb: compactLogin ? 2 : 2.2, alignItems: 'flex-start' }}
            control={
              <CustomCheckbox
                checked={termsChecked}
                onChange={(event) => setTermsChecked(event.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography sx={{ color: compactLogin ? '#111111' : brand.inkSoft, fontSize: '0.86rem', mt: 0.25 }}>
                I agree to{' '}
                <Link
                  component="button"
                  underline="hover"
                  onClick={() => setOpenTerms(true)}
                  sx={{ color: compactLogin ? AUTH_ORANGE : brand.ink, fontWeight: 700 }}
                >
                  Terms and Conditions
                </Link>
              </Typography>
            }
          />

          <CustomIconLoadingButton
            type="submit"
            text={compactLogin ? 'Log In' : 'Send verification code'}
            loading={requesting}
            loadingText="Sending..."
            disabled={Boolean(emailError) || !termsChecked}
            styles={compactLogin ? loginButtonStyles : { width: '100%' }}
            textColor={compactLogin ? '#FFFFFF' : undefined}
            endIconNode={compactLogin ? <FiArrowRight size={28} /> : undefined}
          />
        </Box>
      ) : (
        <Stack component="form" onSubmit={handleVerify} spacing={2}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: '24px',
              border: `1px solid ${alpha(brand.ink, 0.08)}`,
              backgroundColor: alpha(brand.sky, 0.18),
            }}
          >
            <Typography sx={{ color: brand.ink, lineHeight: 1.68, fontSize: '0.9rem' }}>
              Enter the 6-digit code sent to <strong>{email}</strong>.
            </Typography>
          </Box>

          <CodeInput length={6} mode="numeric" value={code} onChange={setCode} />

          {error ? (
            <Typography sx={{ color: brand.danger, textAlign: 'center', fontSize: '0.82rem', fontWeight: 700 }}>
              {error}
            </Typography>
          ) : null}

          <CustomIconLoadingButton
            type="submit"
            text={compactLogin ? 'Verify and Log In' : 'Verify and enter app'}
            loading={verifying}
            loadingText="Verifying..."
            disabled={code.length !== 6}
            styles={compactLogin ? loginButtonStyles : { width: '100%' }}
            textColor={compactLogin ? '#FFFFFF' : undefined}
            endIconNode={compactLogin ? <FiArrowRight size={28} /> : undefined}
          />

          <CustomIconLoadingButton
            type="button"
            text="Resend code"
            variant="text"
            onClick={() => handleRequest()}
            loading={requesting}
            loadingText="Sending..."
            styles={{ width: '100%' }}
          />
        </Stack>
      )}

      <CustomModal
        open={openTerms}
        onClose={() => setOpenTerms(false)}
        title="Terms and Conditions"
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-line',
            maxHeight: '60vh',
            overflowY: 'auto',
            pr: 1,
          }}
        >
          {TERMS_AND_CONDITIONS}
        </Typography>
      </CustomModal>
    </Stack>
  )
}
