import { Box, Button, Stack } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { FiArrowUpRight, FiPhone } from 'react-icons/fi'
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
  primaryTo = '/login',
}: PublicNavbarProps) {
  const location = useLocation()

  return (
    <BrandTopBar
      sx={{ px: { xs: 0.7, sm: 2.2, lg: 3 }, py: { xs: 0.55, sm: 0.85 } }}
      innerSx={{
        background: alpha('#FFFFFF', 0.92),
        border: brandEffects.border,
        boxShadow: '0 14px 34px rgba(68, 92, 138, 0.15)',
        px: { xs: 1.25, sm: 2.05, lg: 2.5 },
        py: { xs: 0.55, sm: 0.7 },
      }}
    >
      <Stack direction="row" spacing={{ xs: 0.75, sm: 2 }} alignItems="center" justifyContent="space-between">
        <RouterLink to="/" aria-label={`${brandIdentity.name} home`}>
          <BrandLogo sx={{ width: { xs: 64, sm: 106, md: 116 } }} />
        </RouterLink>

        <Stack
          direction="row"
          spacing={{ xs: 0.05, sm: 0.35, lg: 0.8 }}
          alignItems="center"
          justifyContent="center"
          sx={{ flex: 1, minWidth: 0 }}
        >
          {links.map((item) => {
            const active = location.pathname === item.to

            return (
              <Box
                key={item.to}
                component={RouterLink}
                to={item.to}
                sx={{
                  px: { xs: 0.18, sm: 0.85, lg: 1.65 },
                  py: { xs: 0.24, sm: 0.55, lg: 0.7 },
                  borderRadius: 999,
                  color: active ? brand.accent : brand.inkSoft,
                  bgcolor: active ? alpha(brand.accent, 0.12) : 'transparent',
                  fontSize: { xs: '0.5rem', sm: '0.7rem', md: '0.86rem' },
                  fontWeight: active ? 800 : 700,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
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
            component="a"
            href={`tel:${brandIdentity.supportPhone}`}
            variant="text"
            startIcon={<FiPhone size={15} />}
            sx={{
              display: { xs: 'none', lg: 'inline-flex' },
              color: brand.ink,
              fontWeight: 800,
              '&:hover': {
                backgroundColor: alpha(brand.ink, 0.06),
              },
            }}
          >
            {brandIdentity.supportPhone}
          </Button>
          <Button
            component={RouterLink}
            to="/login"
            variant="text"
            sx={{
              display: { xs: 'none', xl: 'inline-flex' },
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
              minWidth: { xs: 88, sm: 154 },
              px: { xs: 0.95, sm: 2.15 },
              py: { xs: 0.55, sm: 0.75 },
              borderRadius: 999,
              fontWeight: 800,
              fontSize: { xs: '0.62rem', sm: '0.8rem' },
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              color: '#FFFFFF',
              boxShadow: { xs: '0 12px 24px rgba(255, 122, 21, 0.22)', sm: '0 18px 36px rgba(255, 122, 21, 0.28)' },
            }}
          >
            {primaryLabel}
          </Button>
        </Stack>
      </Stack>
    </BrandTopBar>
  )
}
