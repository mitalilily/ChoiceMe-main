import { Box, Container, IconButton, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { FaFacebookF, FaInstagram, FaLinkedinIn } from 'react-icons/fa6'
import { FiMail, FiMapPin, FiPhone } from 'react-icons/fi'
import { Link as RouterLink } from 'react-router-dom'
import BrandLogo from '../brand/BrandLogo'
import { brand, brandIdentity } from '../../theme/brand'

const platformLinks = [
  { label: 'Portal Login', to: '/login' },
  { label: 'Tracking', to: '/tracking' },
  { label: 'Rate Calculator', to: '/rate-calculator' },
  { label: 'Weight Calculator', to: '/weight-calculator' },
]

const companyLinks = [
  { label: 'Portal Login', to: '/login' },
  { label: 'Track Shipment', to: '/tracking' },
]

export default function PublicFooter() {
  return (
    <Box component="footer" sx={{ mt: 10, pb: 4, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="xl" sx={{ px: 0 }}>
        <Box
          sx={{
            borderRadius: { xs: '32px', md: '42px' },
            background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(246,248,252,0.96) 100%)',
            border: `1px solid ${alpha(brand.ink, 0.08)}`,
            boxShadow: '0 24px 60px rgba(68, 92, 138, 0.14)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1.2fr 0.8fr 0.8fr 1fr' },
              gap: { xs: 3, lg: 4 },
              px: { xs: 2.4, md: 3.2, lg: 4 },
              py: { xs: 3, md: 4 },
            }}
          >
            <Stack spacing={1.5}>
              <RouterLink to="/" aria-label={`${brandIdentity.name} home`}>
                <BrandLogo sx={{ width: { xs: 164, sm: 184 } }} />
              </RouterLink>
              <Typography sx={{ color: brand.inkSoft, lineHeight: 1.75, maxWidth: 360 }}>
                {brandIdentity.tagline} Premium shipping infrastructure for teams that want better
                courier visibility, cleaner rates, and modern delivery experiences.
              </Typography>
              <Stack direction="row" spacing={1}>
                {[
                  { href: 'https://www.linkedin.com/', icon: <FaLinkedinIn size={15} /> },
                  { href: 'https://www.instagram.com/', icon: <FaInstagram size={15} /> },
                  { href: 'https://www.facebook.com/', icon: <FaFacebookF size={15} /> },
                ].map((item) => (
                  <IconButton
                    key={item.href}
                    component="a"
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      color: brand.ink,
                      bgcolor: alpha(brand.ink, 0.06),
                      '&:hover': {
                        bgcolor: alpha(brand.accent, 0.12),
                        color: brand.accent,
                      },
                    }}
                  >
                    {item.icon}
                  </IconButton>
                ))}
              </Stack>
            </Stack>

            <Stack spacing={1.3}>
              <Typography sx={{ fontWeight: 800, color: brand.ink }}>Platform</Typography>
              {platformLinks.map((item) => (
                <Box
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  sx={{
                    color: brand.inkSoft,
                    fontWeight: 600,
                    '&:hover': {
                      color: brand.ink,
                    },
                  }}
                >
                  {item.label}
                </Box>
              ))}
            </Stack>

            <Stack spacing={1.3}>
              <Typography sx={{ fontWeight: 800, color: brand.ink }}>Company</Typography>
              {companyLinks.map((item) => (
                <Box
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  sx={{
                    color: brand.inkSoft,
                    fontWeight: 600,
                    '&:hover': {
                      color: brand.ink,
                    },
                  }}
                >
                  {item.label}
                </Box>
              ))}
            </Stack>

            <Stack spacing={1.4}>
              <Typography sx={{ fontWeight: 800, color: brand.ink }}>Contact</Typography>
              <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <Box sx={{ color: brand.accent, mt: 0.15, lineHeight: 0 }}>
                  <FiPhone size={18} />
                </Box>
                <Box component="a" href={`tel:${brandIdentity.supportPhone}`} sx={{ color: brand.inkSoft }}>
                  {brandIdentity.supportPhone}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <Box sx={{ color: brand.accent, mt: 0.15, lineHeight: 0 }}>
                  <FiMail size={18} />
                </Box>
                <Box component="a" href={`mailto:${brandIdentity.supportEmail}`} sx={{ color: brand.inkSoft }}>
                  {brandIdentity.supportEmail}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <Box sx={{ color: brand.accent, mt: 0.15, lineHeight: 0 }}>
                  <FiMapPin size={18} />
                </Box>
                <Typography sx={{ color: brand.inkSoft }}>{brandIdentity.supportAddress}</Typography>
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              px: { xs: 2.4, md: 4 },
              py: 1.5,
              borderTop: `1px solid ${alpha(brand.ink, 0.08)}`,
              bgcolor: alpha(brand.sky, 0.26),
            }}
          >
            <Typography sx={{ color: brand.inkSoft, fontSize: '0.9rem' }}>
              © 2026 {brandIdentity.name}. Built for dependable logistics operations across India.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
