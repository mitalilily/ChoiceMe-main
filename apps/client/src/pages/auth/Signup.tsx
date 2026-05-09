import { Box, Stack, Typography } from '@mui/material'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import AuthShell from '../../components/auth/AuthShell'
import CredentialAuthForm from '../../components/auth/CredentialAuthForm'
import FullScreenLoader from '../../components/UI/loader/FullScreenLoader'
import { useAuth } from '../../context/auth/AuthContext'
import { brand } from '../../theme/brand'

export default function Signup() {
  const { loading, isAuthenticated } = useAuth()

  if (loading) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to="/app" replace />

  return (
    <AuthShell
      eyebrow="Create Account"
      title="Start shipping with a faster courier workspace."
      subtitle="Create your ChoiceMe account to unlock courier booking, rate checks, shipment tracking, and a smoother delivery workflow."
      helperTitle="Start shipping sooner"
      helperText="Create your account once and move straight into onboarding, courier setup, and day-to-day shipment operations."
      showChrome
      showNavbar={false}
    >
      <Stack spacing={2.4}>
        <Stack spacing={0.8}>
          <Typography
            sx={{
              color: brand.ink,
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.05em',
            }}
          >
            Create your account
          </Typography>
          <Typography sx={{ color: brand.inkSoft, lineHeight: 1.72 }}>
            Enter your name, email, and password to create access using the current backend flow.
            Verification codes show inline on this page whenever the backend exposes them.
          </Typography>
        </Stack>

        <CredentialAuthForm mode="signup" />

        <Typography sx={{ color: brand.inkSoft, textAlign: 'center', fontSize: '0.88rem' }}>
          Already have an account?{' '}
          <Box component={RouterLink} to="/login" sx={{ color: brand.ink, fontWeight: 700 }}>
            Login here
          </Box>
        </Typography>
      </Stack>
    </AuthShell>
  )
}
