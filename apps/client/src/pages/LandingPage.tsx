import {
  alpha,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import { motion } from 'framer-motion'
import { FiArrowRight, FiPhone } from 'react-icons/fi'
import { TbBolt, TbCurrencyRupee, TbPlugConnected, TbRoute, TbTruckDelivery } from 'react-icons/tb'
import { Link as RouterLink } from 'react-router-dom'
import BrandSurface from '../components/brand/BrandSurface'
import PublicFooter from '../components/public/PublicFooter'
import PublicNavbar from '../components/public/PublicNavbar'
import { usePublicLandingStats } from '../hooks/useDashboard'
import { brand, brandGradients, brandIdentity } from '../theme/brand'
import { deliveryOneLogo } from '../utils/constants'

const partnerLogos = [
  { alt: 'Delivery One logo', src: deliveryOneLogo },
  { alt: 'Blue Dart logo', src: '/logo/integrations/bluedart.png' },
  { alt: 'Shadowfax logo', src: '/logo/integrations/shadowfax.png' },
  { alt: 'Xpressbees logo', src: '/logo/integrations/xpressbees.png' },
  { alt: 'Ekart logo', src: '/logo/integrations/ekart.png' },
  { alt: 'India Post logo', src: '/images/temple.svg' },
]

const processSteps = [
  {
    title: 'Connect your orders',
    text: 'Bring store, marketplace, and offline orders into one premium operations layer with clean validations.',
  },
  {
    title: 'Compare live-ready rates',
    text: 'Evaluate courier options by lane, SLA, payment mode, and volumetric weight before you commit.',
  },
  {
    title: 'Dispatch with confidence',
    text: 'Generate labels, assign pickups, and move parcels with real-time milestone updates and exception flags.',
  },
  {
    title: 'Track every promise',
    text: 'Keep customers and teams aligned with a motion-rich timeline from order creation to doorstep delivery.',
  },
]

const featureCards = [
  {
    eyebrow: 'Intelligent Routing',
    title: 'Smart Courier Routing',
    text: 'We pick the best courier for each package based on delivery speed, cost, and what is available.',
    icon: <TbRoute size={24} />,
  },
  {
    eyebrow: 'Complete Visibility',
    title: 'One Place to Track Everything',
    text: 'See all your shipments in one beautiful timeline and know exactly where every package is at every step.',
    icon: <TbTruckDelivery size={24} />,
  },
  {
    eyebrow: 'Simple Payments',
    title: 'Payment Made Simple',
    text: 'Whether you are collecting cash on delivery or paying upfront, the same dashboard keeps money and shipping in view.',
    icon: <TbCurrencyRupee size={24} />,
  },
  {
    eyebrow: 'Easy Integration',
    title: 'Plug Into Your System',
    text: 'Use your existing integrations and APIs without changing your current backend contracts or order logic.',
    icon: <TbPlugConnected size={24} />,
  },
]

const testimonials = [
  {
    initials: 'AK',
    quote:
      'ChoiceMee gave us a premium control-tower feel without operational complexity. Our shipping team now books faster and escalates less.',
    name: 'Aaliya Khan',
    role: 'Head of Operations, NorthGrid Commerce',
  },
  {
    initials: 'RS',
    quote:
      'The tracking experience feels enterprise-grade. Customers see polished delivery milestones while our team gets the data depth we need.',
    name: 'Rohit Sharma',
    role: 'Logistics Lead, UrbanCart India',
  },
  {
    initials: 'MK',
    quote:
      'Rate comparison and volumetric handling are finally clear. That alone reduced misquotes and dispatch confusion for us.',
    name: 'Meera Kaul',
    role: 'Founder, Valley Home Studio',
  },
]

const sectionIntro = {
  eyebrowSx: {
    fontSize: { xs: '0.68rem', sm: '0.72rem' },
    fontWeight: 800,
    color: brand.accent,
    textTransform: 'uppercase',
    letterSpacing: { xs: '0.12em', sm: '0.16em' },
  },
  titleSx: {
    mt: 1,
    fontSize: { xs: '2rem', md: '2.7rem' },
    lineHeight: 1.02,
    fontWeight: 800,
    letterSpacing: '-0.05em',
    color: brand.ink,
  },
  copySx: {
    mt: 1.4,
    color: brand.inkSoft,
    lineHeight: 1.82,
    maxWidth: 760,
  },
} as const

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.45 },
}

export default function LandingPage() {
  const { data: landingStats } = usePublicLandingStats()
  const supportPhoneHref = `tel:${brandIdentity.supportPhone}`

  const liveValue = (value?: number, suffix = '') => {
    const safeValue = Number.isFinite(value) ? (value ?? 0) : 0
    return `${new Intl.NumberFormat('en-IN').format(safeValue)}${suffix}`
  }

  const livePickupsLabel = `${liveValue(landingStats?.livePickups)} live pickups`

  const proofPoints = [
    { value: liveValue(landingStats?.enabledCouriers), label: 'Enabled courier networks' },
    { value: liveValue(landingStats?.trackingVisibilityRate, '%'), label: 'Orders with AWB visibility' },
    { value: liveValue(landingStats?.annualShipments), label: 'Shipments in the last 365 days' },
    { value: liveValue(landingStats?.monthlyOrders), label: 'Orders created this month' },
  ]

  const dashboardPreviewMetrics = [
    {
      label: 'Shipments delivered this month',
      value: liveValue(landingStats?.monthlyDeliveredShipments),
    },
    {
      label: 'Courier partners active in orders',
      value: liveValue(landingStats?.activeCouriers),
    },
  ]

  return (
    <Box className="site-shell">
      <PublicNavbar />

      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 6, md: 8 } }}>
        <Stack spacing={{ xs: 4.2, md: 7 }}>
          <Box
            component={motion.section}
            {...fadeUp}
            sx={{
              pt: { xs: 0.7, md: 1.8 },
            }}
          >
            <Grid container spacing={{ xs: 2, md: 2.4 }}>
              <Grid size={{ xs: 12 }}>
                <Stack spacing={2.2} sx={{ maxWidth: 760 }}>
                  <Chip
                    icon={<TbBolt size={16} />}
                    label={`${brandIdentity.shortName} Logistics for modern shipping teams`}
                    sx={{
                      alignSelf: 'flex-start',
                      bgcolor: alpha('#FFFFFF', 0.9),
                      color: brand.ink,
                      border: `1px solid ${alpha(brand.ink, 0.08)}`,
                      fontWeight: 700,
                      maxWidth: '100%',
                      px: { xs: 0.1, sm: 0.6 },
                      fontSize: { xs: '0.66rem', sm: '0.78rem' },
                      '& .MuiChip-label': {
                        px: { xs: 0.8, sm: 1.2 },
                        whiteSpace: 'normal',
                      },
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize: { xs: '2.7rem', sm: '4rem', lg: '4.85rem' },
                      lineHeight: { xs: 1.03, lg: 0.98 },
                      fontWeight: 900,
                      letterSpacing: '-0.06em',
                      color: brand.ink,
                    }}
                  >
                    Fastest Shipping
                    <Box component="span" sx={{ display: 'block', color: brand.accent }}>
                      Across India
                    </Box>
                  </Typography>

                  <Typography
                    sx={{
                      color: brand.inkSoft,
                      maxWidth: 620,
                      fontSize: { xs: '1rem', md: '1.08rem' },
                      lineHeight: 1.85,
                    }}
                  >
                    {brandIdentity.tagline} Launch premium shipping experiences with rate intelligence,
                    unified tracking, and beautiful operational clarity while keeping the current client
                    and backend business logic intact.
                  </Typography>

                  <Stack direction="row" spacing={{ xs: 1, sm: 1.4 }}>
                    <Button
                      component={RouterLink}
                      to="/login"
                      variant="contained"
                      endIcon={<FiArrowRight size={18} />}
                      sx={{ flex: { xs: 1, sm: 'initial' }, minWidth: { sm: 168 }, minHeight: { xs: 44, sm: 48 } }}
                    >
                      Start Shipping
                    </Button>
                    <Button
                      component={RouterLink}
                      to="/tracking"
                      variant="outlined"
                      sx={{ flex: { xs: 1, sm: 'initial' }, minWidth: { sm: 144 }, minHeight: { xs: 44, sm: 48 } }}
                    >
                      Track Order
                    </Button>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 0.5, sm: 1 }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    sx={{ color: brand.inkSoft }}
                  >
                    <Typography sx={{ fontSize: { xs: '0.82rem', sm: '0.94rem' }, fontWeight: 700 }}>
                      Need shipping help?
                    </Typography>
                    <Box
                      component="a"
                      href={supportPhoneHref}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        color: brand.ink,
                        fontWeight: 900,
                        fontSize: { xs: '0.94rem', sm: '1rem' },
                      }}
                    >
                      <FiPhone size={16} />
                      {brandIdentity.supportPhone}
                    </Box>
                  </Stack>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: { xs: 0.8, sm: 1.2 },
                      maxWidth: { xs: '100%', md: 760 },
                    }}
                  >
                    {proofPoints.slice(0, 3).map((item) => (
                      <BrandSurface
                        key={item.label}
                        variant="glass"
                        sx={{ p: { xs: 1.05, sm: 1.7 }, borderRadius: { xs: '18px', sm: '24px' } }}
                      >
                        <Typography sx={{ color: brand.ink, fontWeight: 900, fontSize: { xs: '1rem', sm: '1.35rem' } }}>
                          {item.value}
                        </Typography>
                        <Typography sx={{ color: brand.inkSoft, fontSize: { xs: '0.66rem', sm: '0.82rem' }, lineHeight: 1.45 }}>
                          {item.label}
                        </Typography>
                      </BrandSurface>
                    ))}
                  </Box>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <BrandSurface
                  variant="hero"
                  sx={{
                    p: { xs: 1.7, md: 2.6 },
                    mt: { xs: 0.5, md: 0.7 },
                    minHeight: { md: 300 },
                    width: '100%',
                    justifyContent: 'space-between',
                    background: `
                      radial-gradient(circle at 15% 10%, rgba(255,255,255,0.82), transparent 20%),
                      radial-gradient(circle at 92% 0%, rgba(255, 156, 75, 0.18), transparent 24%),
                      ${brandGradients.hero}
                    `,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.2}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ color: brand.inkSoft, fontSize: { xs: '0.64rem', sm: '0.74rem' }, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        Dispatch Overview
                      </Typography>
                      <Typography sx={{ color: brand.ink, fontSize: { xs: '1rem', sm: '1.65rem' }, fontWeight: 800, mt: 0.5, lineHeight: 1.1 }}>
                        Today&apos;s network pulse
                      </Typography>
                    </Box>
                    <Chip
                      icon={<TbTruckDelivery size={16} />}
                      label={livePickupsLabel}
                      sx={{
                        bgcolor: alpha('#FFFFFF', 0.84),
                        color: brand.ink,
                        fontWeight: 800,
                        flexShrink: 0,
                        fontSize: { xs: '0.64rem', sm: '0.78rem' },
                        '& .MuiChip-label': { px: { xs: 0.8, sm: 1.2 } },
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: { xs: 0.8, sm: 1.2 },
                    }}
                  >
                    {dashboardPreviewMetrics.map((item) => (
                      <BrandSurface
                        key={item.label}
                        variant="glass"
                        sx={{ p: { xs: 1.1, sm: 1.8 }, borderRadius: { xs: '18px', sm: '24px' } }}
                      >
                        <Typography sx={{ color: brand.inkSoft, fontSize: { xs: '0.62rem', sm: '0.82rem' }, lineHeight: 1.45 }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ color: brand.ink, fontWeight: 900, fontSize: { xs: '1rem', sm: '1.75rem' }, mt: 0.45 }}>
                          {item.value}
                        </Typography>
                      </BrandSurface>
                    ))}
                  </Box>

                  <BrandSurface variant="soft" sx={{ p: { xs: 1.2, sm: 2.2 }, borderRadius: { xs: '18px', sm: '28px' } }}>
                    <Stack spacing={{ xs: 0.9, sm: 1.2 }}>
                      {[
                        'See live shipments and what is happening across your network.',
                        'Different teams see the operational slices they need without workflow clutter.',
                        'Build your own tools with the existing APIs and integrations already in the repo.',
                      ].map((item) => (
                        <Stack key={item} direction="row" spacing={1.1} alignItems="flex-start">
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              bgcolor: brand.accent,
                              mt: 0.55,
                              flexShrink: 0,
                            }}
                          />
                          <Typography sx={{ color: brand.inkSoft, lineHeight: 1.6, fontSize: { xs: '0.78rem', sm: '1rem' } }}>
                            {item}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </BrandSurface>
                </BrandSurface>
              </Grid>
            </Grid>
          </Box>

          <Box component={motion.section} {...fadeUp}>
            <BrandSurface variant="glass" sx={{ p: { xs: 2.2, md: 3 }, borderRadius: '36px' }}>
              <Grid container spacing={{ xs: 1.4, md: 3 }} alignItems="center">
                <Grid size={{ xs: 5, md: 4 }}>
                  <Typography sx={sectionIntro.eyebrowSx}>Brand integration</Typography>
                  <Box component="img" src="/brand/choiceme-logo.png" alt={brandIdentity.name} sx={{ mt: 1.3, width: { xs: 104, md: 210 }, height: 'auto' }} />
                  <Typography sx={{ ...sectionIntro.copySx, mt: 1.2, fontSize: { xs: '0.74rem', md: '1rem' }, lineHeight: { xs: 1.5, md: 1.82 } }}>
                    {brandIdentity.tagline} Connected with leading courier brands in one trusted shipping workflow.
                  </Typography>
                </Grid>
                <Grid size={{ xs: 7, md: 8 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: { xs: 0.7, sm: 1.2 },
                    }}
                  >
                    {partnerLogos.map((item) => (
                      <BrandSurface
                        key={item.alt}
                        variant="soft"
                        sx={{
                          p: { xs: 1.05, sm: 2 },
                          borderRadius: { xs: '18px', sm: '24px' },
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: { xs: 72, sm: 110 },
                        }}
                      >
                        <Box component="img" src={item.src} alt={item.alt} sx={{ width: '100%', maxWidth: { xs: 58, sm: 116 }, objectFit: 'contain', filter: 'grayscale(0.08)' }} />
                      </BrandSurface>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </BrandSurface>
          </Box>

          <Box component={motion.section} {...fadeUp}>
            <Typography sx={sectionIntro.eyebrowSx}>How it works</Typography>
            <Typography sx={sectionIntro.titleSx}>A frictionless dispatch workflow from order sync to doorstep delivery</Typography>
            <Typography sx={sectionIntro.copySx}>
              Each step is built to feel fast, polished, and operationally reliable for logistics teams.
            </Typography>

            <Grid container spacing={{ xs: 1.2, sm: 1.6 }} sx={{ mt: 1 }}>
              {processSteps.map((step, index) => (
                <Grid key={step.title} size={{ xs: 6, lg: 3 }}>
                  <BrandSurface variant="card" sx={{ p: { xs: 1.35, sm: 2.2 }, borderRadius: { xs: '18px', sm: '28px' } }}>
                    <Box
                      sx={{
                        width: { xs: 38, sm: 56 },
                        height: { xs: 38, sm: 56 },
                        borderRadius: 999,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: index < 3 ? brand.accent : alpha(brand.ink, 0.08),
                        color: index < 3 ? '#FFFFFF' : brand.inkSoft,
                        fontSize: { xs: '0.74rem', sm: '1rem' },
                        fontWeight: 900,
                      }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Box>
                    <Typography sx={{ mt: { xs: 1.2, sm: 2 }, color: brand.ink, fontWeight: 800, fontSize: { xs: '0.94rem', sm: '1.05rem' }, lineHeight: 1.15 }}>
                      {step.title}
                    </Typography>
                    <Typography sx={{ mt: 0.75, color: brand.inkSoft, lineHeight: 1.55, fontSize: { xs: '0.78rem', sm: '1rem' } }}>
                      {step.text}
                    </Typography>
                  </BrandSurface>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box component={motion.section} {...fadeUp}>
            <Typography sx={sectionIntro.eyebrowSx}>Platform features</Typography>
            <Typography sx={sectionIntro.titleSx}>Everything you need to ship smart, track easy, and grow fast</Typography>
            <Typography sx={sectionIntro.copySx}>
              Smart routing picks the best courier for every parcel. Real-time tracking keeps everyone in the loop. And one simple dashboard controls it all from rates to payments.
            </Typography>

            <Grid container spacing={1.6} sx={{ mt: 1 }}>
              {featureCards.map((card) => (
                <Grid key={card.title} size={{ xs: 12, md: 6 }}>
                  <BrandSurface variant="soft" sx={{ p: 2.4, borderRadius: '30px' }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '18px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(brand.accent, 0.14),
                        color: brand.accent,
                      }}
                    >
                      {card.icon}
                    </Box>
                    <Typography sx={{ mt: 1.8, color: brand.accent, fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                      {card.eyebrow}
                    </Typography>
                    <Typography sx={{ mt: 0.8, color: brand.ink, fontWeight: 800, fontSize: '1.12rem' }}>
                      {card.title}
                    </Typography>
                    <Typography sx={{ mt: 1, color: brand.inkSoft, lineHeight: 1.78 }}>
                      {card.text}
                    </Typography>
                  </BrandSurface>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box component={motion.section} {...fadeUp}>
            <Grid container spacing={{ xs: 2.2, md: 3 }} alignItems="stretch">
              <Grid size={{ xs: 12, lg: 5 }}>
                <Typography sx={sectionIntro.eyebrowSx}>Operations dashboard</Typography>
                <Typography sx={sectionIntro.titleSx}>Your shipping command center: beautiful, simple, and powerful</Typography>
                <Typography sx={sectionIntro.copySx}>
                  One place to see everything. Watch live pickups, see all your shipments, check your metrics, and run your shipping operation with clarity.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, lg: 7 }}>
                <BrandSurface
                  variant="hero"
                  sx={{
                    p: { xs: 2.4, md: 3 },
                    borderRadius: '34px',
                    background: `
                      radial-gradient(circle at 100% 0%, rgba(255, 156, 75, 0.18), transparent 24%),
                      ${brandGradients.analytics}
                    `,
                  }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{ color: brand.inkSoft, fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                          Dispatch overview
                        </Typography>
                        <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.55rem', mt: 0.8 }}>
                          Today&apos;s network pulse
                        </Typography>
                      </Box>
                      <Chip label={livePickupsLabel} sx={{ bgcolor: alpha('#FFFFFF', 0.84), color: brand.ink, fontWeight: 800 }} />
                    </Stack>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1.2,
                      }}
                    >
                      {dashboardPreviewMetrics.map((item) => (
                        <BrandSurface key={item.label} variant="glass" sx={{ p: 1.8, borderRadius: '24px' }}>
                          <Typography sx={{ color: brand.inkSoft, fontSize: '0.82rem' }}>{item.label}</Typography>
                          <Typography sx={{ color: brand.ink, fontWeight: 900, fontSize: '1.75rem', mt: 0.6 }}>
                            {item.value}
                          </Typography>
                        </BrandSurface>
                      ))}
                    </Box>

                    <BrandSurface variant="glass" sx={{ p: 2, borderRadius: '26px' }}>
                      <Stack spacing={1.1}>
                        {[
                          'See live shipments and what is happening right now across your network.',
                          'Different team members see only what they need, from pickup queues to reports.',
                          'Build your own tools with the existing APIs and workflow services already in the repo.',
                        ].map((item) => (
                          <Stack key={item} direction="row" spacing={1.1}>
                            <Box sx={{ width: 9, height: 9, borderRadius: 999, bgcolor: brand.accent, mt: 0.75, flexShrink: 0 }} />
                            <Typography sx={{ color: brand.inkSoft, lineHeight: 1.7 }}>{item}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </BrandSurface>
                  </Stack>
                </BrandSurface>
              </Grid>
            </Grid>
          </Box>

          <Box component={motion.section} {...fadeUp}>
            <BrandSurface variant="glass" sx={{ p: { xs: 2.4, md: 3 }, borderRadius: '36px' }}>
              <Typography sx={{ ...sectionIntro.eyebrowSx, textAlign: 'center' }}>Proof points</Typography>
              <Typography sx={{ ...sectionIntro.titleSx, textAlign: 'center' }}>Trusted by thousands of shipping businesses</Typography>
              <Typography sx={{ ...sectionIntro.copySx, mx: 'auto', textAlign: 'center' }}>
                These numbers show how powerful the platform becomes once courier comparison, tracking, and dispatch are brought into one workflow.
              </Typography>

              <Box
                sx={{
                  mt: 3,
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                  gap: 1.4,
                }}
              >
                {proofPoints.map((item) => (
                  <BrandSurface key={item.label} variant="soft" sx={{ p: 2, borderRadius: '26px', textAlign: 'center' }}>
                    <Typography sx={{ color: brand.ink, fontSize: { xs: '1.8rem', md: '2.2rem' }, fontWeight: 900 }}>
                      {item.value}
                    </Typography>
                    <Typography sx={{ mt: 0.8, color: brand.inkSoft, lineHeight: 1.65 }}>
                      {item.label}
                    </Typography>
                  </BrandSurface>
                ))}
              </Box>
            </BrandSurface>
          </Box>

          <Box component={motion.section} {...fadeUp}>
            <Typography sx={sectionIntro.eyebrowSx}>Testimonials</Typography>
            <Typography sx={sectionIntro.titleSx}>What customers love about ChoiceMee Logistics</Typography>
            <Typography sx={sectionIntro.copySx}>
              Shipping teams, store owners, and logistics managers all choose us because we make their day-to-day operations clearer and faster.
            </Typography>

            <Grid container spacing={1.6} sx={{ mt: 1 }}>
              {testimonials.map((item) => (
                <Grid key={item.name} size={{ xs: 12, lg: 4 }}>
                  <BrandSurface variant="card" sx={{ p: 2.4, borderRadius: '30px' }}>
                    <Typography sx={{ color: brand.ink, fontSize: '1.02rem', lineHeight: 1.8 }}>
                      &quot;{item.quote}&quot;
                    </Typography>
                    <Divider sx={{ my: 2, borderColor: alpha(brand.ink, 0.08) }} />
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Box
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: 999,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(brand.accent, 0.16),
                          color: brand.accent,
                          fontWeight: 900,
                        }}
                      >
                        {item.initials}
                      </Box>
                      <Box>
                        <Typography sx={{ color: brand.ink, fontWeight: 800 }}>{item.name}</Typography>
                        <Typography sx={{ color: brand.inkSoft, fontSize: '0.84rem' }}>{item.role}</Typography>
                      </Box>
                    </Stack>
                  </BrandSurface>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box component={motion.section} {...fadeUp}>
            <BrandSurface
              variant="dark"
              sx={{
                p: { xs: 2.6, md: 3.4 },
                borderRadius: '38px',
                background: 'linear-gradient(135deg, #0D1B4D 0%, #18346F 100%)',
              }}
            >
              <Grid container spacing={2.2} alignItems="center">
                <Grid size={{ xs: 12, md: 8 }}>
                  <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#FFE3C4' }}>
                    Get started today
                  </Typography>
                  <Typography sx={{ mt: 1.2, fontSize: { xs: '2rem', md: '2.7rem' }, lineHeight: 1.02, fontWeight: 800, letterSpacing: '-0.05em', color: '#FFFFFF' }}>
                    Start shipping smarter with {brandIdentity.name}
                  </Typography>
                  <Typography sx={{ mt: 1.4, color: '#EAF1FB', lineHeight: 1.8, maxWidth: 680 }}>
                    Try the free rate calculator, compare couriers, track shipments live, or open the seller portal and move straight into the existing auth and dashboard flow.{' '}
                    For direct support, call {brandIdentity.supportPhone}.
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack direction={{ xs: 'column', sm: 'row', md: 'column' }} spacing={1.2}>
                    <Button component={RouterLink} to="/rate-calculator" variant="contained" color="primary">
                      Explore Rates
                    </Button>
                    <Button component={RouterLink} to="/login" variant="outlined" sx={{ borderColor: alpha('#FFFFFF', 0.32), color: '#FFFFFF', '&:hover': { borderColor: alpha('#FFFFFF', 0.58) } }}>
                      Open Portal
                    </Button>
                    <Button
                      component="a"
                      href={supportPhoneHref}
                      variant="outlined"
                      startIcon={<FiPhone size={17} />}
                      sx={{
                        borderColor: alpha('#FFFFFF', 0.32),
                        color: '#FFFFFF',
                        '&:hover': { borderColor: alpha('#FFFFFF', 0.58) },
                      }}
                    >
                      {brandIdentity.supportPhone}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </BrandSurface>
          </Box>
        </Stack>
      </Container>

      <PublicFooter />
    </Box>
  )
}


