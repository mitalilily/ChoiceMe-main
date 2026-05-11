import { Box, Button, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useState } from 'react'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import AuthShell from '../../components/auth/AuthShell'
import CredentialAuthForm from '../../components/auth/CredentialAuthForm'
import OtpLoginPanel from '../../components/auth/OtpLoginPanel'
import FullScreenLoader from '../../components/UI/loader/FullScreenLoader'
import { useAuth } from '../../context/auth/AuthContext'
import { brand } from '../../theme/brand'

const AUTH_NAVY = '#0D1B4D'
const AUTH_ORANGE = '#E86F00'

export default function Login() {
  const { loading, isAuthenticated } = useAuth()
  const [mode, setMode] = useState<'otp' | 'password'>('otp')

  if (loading) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to="/app" replace />

  return (
    <AuthShell
      eyebrow="Client Auth"
      title={'Ship with Confidence.\nWe Deliver Commitment.'}
      subtitle="Manage your shipments, track deliveries, and stay updated - all in one place."
      helperTitle="Welcome Back to ChoiceMe"
      helperText="Please log in to manage your shipments"
      showChrome
      showNavbar={false}
    >
      <Stack spacing={2.2}>
        <Box
          sx={{
            borderRadius: '7px',
            border: `1px solid ${alpha(AUTH_NAVY, 0.18)}`,
            backgroundColor: alpha('#FFFFFF', 0.7),
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            boxShadow: `0 8px 20px ${alpha(AUTH_NAVY, 0.05)}`,
          }}
        >
          {[
            { value: 'otp', label: 'Email OTP' },
            { value: 'password', label: 'Email + Password', mobileLabel: 'Password' },
          ].map((item) => (
            <Button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value as 'otp' | 'password')}
              sx={{
                borderRadius: 0,
                py: { xs: 1.15, sm: 1.35 },
                px: { xs: 0.5, sm: 1 },
                minHeight: 56,
                background: mode === item.value ? '#FFFFFF' : 'rgba(247,248,252,0.72)',
                color: mode === item.value ? AUTH_ORANGE : alpha(AUTH_NAVY, 0.72),
                fontWeight: 800,
                fontSize: { xs: '0.68rem', sm: '0.96rem' },
                textTransform: 'none',
                whiteSpace: 'nowrap',
                borderBottom: `3px solid ${mode === item.value ? AUTH_ORANGE : 'transparent'}`,
                borderRight:
                  item.value === 'otp'
                    ? `1px solid ${alpha(AUTH_NAVY, 0.14)}`
                    : '1px solid transparent',
                '&:hover': {
                  background: '#FFFFFF',
                  color: mode === item.value ? AUTH_ORANGE : AUTH_NAVY,
                },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {item.label}
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                {item.mobileLabel ?? item.label}
              </Box>
            </Button>
          ))}
        </Box>

        {mode === 'otp' ? (
          <OtpLoginPanel showIntro={false} compactLogin />
        ) : (
          <CredentialAuthForm mode="login" showIntro={false} compactLogin />
        )}

        <Typography sx={{ color: brand.inkSoft, textAlign: 'center', fontSize: '0.86rem' }}>
          New to ChoiceMe?{' '}
          <Box component={RouterLink} to="/signup" sx={{ color: AUTH_ORANGE, fontWeight: 800 }}>
            Create an account
          </Box>
        </Typography>
      </Stack>
    </AuthShell>
  )
}
