import { Box, Button, Stack } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import AuthShell from '../../components/auth/AuthShell'
import CredentialAuthForm from '../../components/auth/CredentialAuthForm'
import OtpLoginPanel from '../../components/auth/OtpLoginPanel'
import FullScreenLoader from '../../components/UI/loader/FullScreenLoader'
import { useAuth } from '../../context/auth/AuthContext'

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
      title={'Ship Smarter.\nDeliver Faster.'}
      subtitle="Track orders, compare courier options, and keep every delivery moving from one polished ChoiceMe workspace."
      helperTitle="Welcome Back to ChoiceMe"
      helperText="Sign in to open your courier command center."
      showChrome
      showNavbar={false}
    >
      <Stack spacing={{ xs: 1.25, md: 1.35 }}>
        <Box
          sx={{
            borderRadius: '7px',
            border: 'none',
            backgroundColor: alpha('#FFFFFF', 0.42),
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            boxShadow: 'none',
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
                py: { xs: 0.75, sm: 0.82 },
                px: { xs: 0.5, sm: 1 },
                minHeight: 40,
                background: mode === item.value ? '#FFFFFF' : 'rgba(247,248,252,0.54)',
                color: mode === item.value ? AUTH_ORANGE : alpha(AUTH_NAVY, 0.72),
                fontWeight: 800,
                fontSize: { xs: '0.68rem', sm: '0.86rem' },
                textTransform: 'none',
                whiteSpace: 'nowrap',
                borderBottom: `3px solid ${mode === item.value ? AUTH_ORANGE : 'transparent'}`,
                borderRight: 'none',
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
      </Stack>
    </AuthShell>
  )
}
