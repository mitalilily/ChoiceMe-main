import { Box, Button, Stack } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { FiArrowUpRight } from 'react-icons/fi'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import BrandLogo from '../brand/BrandLogo'
import BrandTopBar from '../brand/BrandTopBar'
import { brand, brandEffects, brandIdentity } from '../../theme/brand'

type NavItem = {
  label: string
  to: string
}

interface PublicNavbarProps {
  links?: NavItem[]
  primaryLabel?: string
  primaryTo?: string
}

const defaultLinks: NavItem[] = [
  { label: 'Tracking', to: '/tracking' },
  { label: 'Rate Calculator', to: '/rate-calculator' },
  { label: 'Weight Calculator', to: '/weight-calculator' },
]

export default function PublicNavbar({
  links = defaultLinks,
  primaryLabel = 'Start Shipping',
  primaryTo = '/signup',
}: PublicNavbarProps) {
  const location = useLocation()

  return (
    <BrandTopBar
      sx={{ px: { xs: 1.4, sm: 2.4, lg: 3.2 }, py: { xs: 1, sm: 1.35 } }}
      innerSx={{
        background: alpha('#FFFFFF', 0.92),
        border: brandEffects.border,
        boxShadow: '0 18px 48px rgba(68, 92, 138, 0.18)',
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <RouterLink to="/login" aria-label={`${brandIdentity.name} login`}>
          <BrandLogo sx={{ width: { xs: 108, sm: 118, md: 128 } }} />
        </RouterLink>

        <Stack
          direction="row"
          spacing={{ sm: 0.2, lg: 0.8 }}
          alignItems="center"
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          {links.map((item) => {
            const active = location.pathname === item.to

            return (
              <Box
                key={item.to}
                component={RouterLink}
                to={item.to}
                sx={{
                  px: { sm: 1.2, lg: 1.65 },
                  py: 1,
                  borderRadius: 999,
                  color: active ? brand.accent : brand.inkSoft,
                  bgcolor: active ? alpha(brand.accent, 0.12) : 'transparent',
                  fontSize: '0.92rem',
                  fontWeight: active ? 800 : 700,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: brand.ink,
                    bgcolor: alpha(brand.ink, 0.06),
                  },
                }}
              >
                {item.label}
              </Box>
            )
          })}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            component={RouterLink}
            to="/login"
            variant="text"
            sx={{
              display: { xs: 'none', lg: 'inline-flex' },
              color: brand.ink,
              fontWeight: 700,
              '&:hover': {
                backgroundColor: alpha(brand.ink, 0.06),
              },
            }}
          >
            Portal Login
          </Button>
          <Button
            component={RouterLink}
            to={primaryTo}
            variant="contained"
            endIcon={<FiArrowUpRight size={18} />}
            sx={{
              minWidth: { xs: 0, sm: 186 },
              px: { xs: 2.2, sm: 2.8 },
              py: 1.15,
              borderRadius: 999,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: '#FFFFFF',
              boxShadow: '0 18px 36px rgba(255, 122, 21, 0.28)',
            }}
          >
            {primaryLabel}
          </Button>
        </Stack>
      </Stack>
    </BrandTopBar>
  )
}
