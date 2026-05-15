import { Box, Stack, Typography } from '@mui/material'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import AuthShell from '../../components/auth/AuthShell'
import CredentialAuthForm from '../../components/auth/CredentialAuthForm'
import FullScreenLoader from '../../components/UI/loader/FullScreenLoader'
import { useAuth } from '../../context/auth/AuthContext'
import { brand } from '../../theme/brand'
import { getPostAuthRedirect } from '../../utils/authRedirect'

export default function Signup() {
  const { loading, isAuthenticated, user } = useAuth()

  if (loading) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to={getPostAuthRedirect(user)} replace />

  return (
    <AuthShell
      eyebrow="Create Account"
      title="Start shipping with a faster courier workspace."
      subtitle="Create your ChoiceMee account to unlock courier booking, rate checks, shipment tracking, and a smoother delivery workflow."
      helperTitle="Start shipping sooner"
      helperText="Create your account once and move straight into onboarding, courier setup, and day-to-day shipment operations."
      showChrome
      showNavbar={false}
    >
      <Stack spacing={{ xs: 1.8, md: 2 }}>
        <Stack spacing={0.65}>
          <Typography
            sx={{
              color: brand.ink,
              fontSize: { xs: '1.36rem', sm: '1.58rem' },
              fontWeight: 800,
              letterSpacing: 0,
            }}
          >
            Create your account
          </Typography>
          <Typography sx={{ color: brand.inkSoft, lineHeight: 1.55, fontSize: '0.9rem' }}>
            Enter your name, email, and password. We will send a verification code to your email
            before opening onboarding.
          </Typography>
        </Stack>

        <CredentialAuthForm mode="signup" showIntro={false} />

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


