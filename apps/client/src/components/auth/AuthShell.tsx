import { Box, Grid, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import BrandLogo from '../brand/BrandLogo'
import { brand } from '../../theme/brand'

interface AuthShellProps {
  eyebrow: string
  title: string
  subtitle: string
  helperTitle: string
  helperText: string
  variant?: 'default' | 'compact'
  showChrome?: boolean
  showNavbar?: boolean
  showFooter?: boolean
  children: React.ReactNode
}

const authPalette = {
  navy: '#0D1B4D',
  orange: '#E86F00',
  text: '#111111',
  muted: '#3C465F',
  blob: '#E8F7FF',
  blobEdge: '#DDF0FC',
}

const deliveryArtwork = '/images/client-auth-delivery-van-theme.png'
const authDisplayFont = '"Plus Jakarta Sans", "Poppins", ui-sans-serif, system-ui, sans-serif'

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  helperTitle,
  helperText,
  variant = 'default',
  children,
}: AuthShellProps) {
  const isCompact = variant === 'compact'
  const titleLines = title.split('\n').filter(Boolean)

  return (
    <Box
      aria-label={eyebrow}
      sx={{
        height: { xs: 'auto', lg: '100dvh' },
        minHeight: { xs: '100dvh', lg: 0 },
        width: '100%',
        boxSizing: 'border-box',
        bgcolor: '#FFFFFF',
        color: authPalette.text,
        fontFamily: authDisplayFont,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowX: 'hidden',
        overflowY: { xs: 'auto', lg: 'hidden' },
        p: { xs: 0.9, sm: 1.1, md: 1.25, lg: 0.7 },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: { xs: '100%', lg: isCompact ? 'min(790px, calc(100vw - 36px))' : 'min(1480px, calc(100vw - 40px))' },
          maxWidth: '100%',
          height: { xs: 'auto', lg: 'min(720px, calc(100dvh - 14px))' },
          minHeight: { xs: 'auto', lg: 0 },
          maxHeight: { lg: 'calc(100dvh - 14px)' },
          borderRadius: 0,
          border: 'none',
          overflow: 'hidden',
          bgcolor: 'transparent',
          boxShadow: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            zIndex: 0,
            inset: { xs: '18px -44% 18px -30%', lg: '0 6% 0 7%' },
            bgcolor: authPalette.blob,
            background: `linear-gradient(145deg, ${authPalette.blob} 0%, #F4FBFF 48%, ${authPalette.blobEdge} 100%)`,
            borderRadius: {
              xs: '42% 58% 48% 52% / 12% 16% 84% 88%',
              lg: '46% 54% 50% 50% / 16% 18% 82% 84%',
            },
            transform: { xs: 'rotate(-1.5deg)', md: 'rotate(-2deg)' },
          }}
        />

        <Grid
          container
          sx={{
            position: 'relative',
            zIndex: 1,
            minHeight: 'inherit',
            minWidth: 0,
            width: '100%',
            height: { xs: 'auto', lg: '100%' },
            boxSizing: 'border-box',
            px: { xs: 1.4, sm: 2, md: 2.6, lg: 2.2 },
            py: { xs: 2, sm: 2.4, md: 2.8, lg: 2 },
          }}
        >
          {!isCompact && (
            <Grid
              size={{ xs: 12, lg: 6.6 }}
              sx={{
                display: 'flex',
                alignItems: { xs: 'center', lg: 'center' },
                height: { xs: 'auto', lg: '100%' },
                minHeight: 0,
                minWidth: 0,
              }}
            >
              <Stack
                sx={{
                  width: '100%',
                  justifyContent: 'center',
                  alignItems: { xs: 'center', lg: 'flex-start' },
                  textAlign: { xs: 'center', lg: 'left' },
                  pt: { xs: 0.4, lg: 0 },
                  pb: { xs: 1.2, lg: 0 },
                  gap: { xs: 1.5, lg: 1.2 },
                }}
              >
                <Stack
                  spacing={{ xs: 0.9, md: 1 }}
                  sx={{ width: '100%', maxWidth: 520, minWidth: 0 }}
                >
                  <Box
                    component="span"
                    sx={{
                      alignSelf: { xs: 'center', lg: 'flex-start' },
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.8,
                      width: 'fit-content',
                      px: { xs: 1, sm: 1.18 },
                      py: 0.55,
                      borderRadius: 999,
                      border: 'none',
                      bgcolor: alpha('#FFFFFF', 0.84),
                      color: authPalette.navy,
                      fontSize: { xs: '0.66rem', sm: '0.72rem' },
                      fontWeight: 800,
                      lineHeight: 1,
                      textTransform: 'uppercase',
                      letterSpacing: 0,
                      boxShadow: 'none',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: authPalette.orange,
                        boxShadow: `0 0 0 4px ${alpha(authPalette.orange, 0.12)}`,
                      }}
                    />
                    Courier Command Login
                  </Box>

                  <Typography
                    component="h1"
                    sx={{
                      color: authPalette.navy,
                      fontFamily: authDisplayFont,
                      fontSize: { xs: '1.64rem', sm: '2.18rem', md: '2.52rem', lg: '2.62rem' },
                      lineHeight: { xs: 1.08, md: 1.02 },
                      fontWeight: 800,
                      letterSpacing: 0,
                      overflowWrap: 'break-word',
                      textShadow: `0 12px 28px ${alpha(authPalette.navy, 0.1)}`,
                    }}
                  >
                    {titleLines.map((line, index) => (
                      <Box
                        component="span"
                        key={line}
                        sx={{
                          display: 'block',
                          color: index === titleLines.length - 1 ? 'transparent' : authPalette.navy,
                          background:
                            index === titleLines.length - 1
                              ? `linear-gradient(90deg, ${authPalette.orange} 0%, #FFB15A 48%, ${authPalette.navy} 100%)`
                              : 'none',
                          WebkitBackgroundClip: index === titleLines.length - 1 ? 'text' : 'border-box',
                          backgroundClip: index === titleLines.length - 1 ? 'text' : 'border-box',
                        }}
                      >
                        {line}
                      </Box>
                    ))}
                  </Typography>
                  <Typography
                    sx={{
                      color: authPalette.muted,
                      fontSize: { xs: '0.9rem', sm: '1rem', md: '1.04rem' },
                      fontWeight: 600,
                      lineHeight: 1.52,
                      maxWidth: { xs: 300, sm: 460 },
                      overflowWrap: 'break-word',
                    }}
                  >
                    {subtitle}
                  </Typography>
                </Stack>

                <Box
                  component="img"
                  src={deliveryArtwork}
                  alt="Delivery van with courier team"
                  sx={{
                    width: { xs: '66%', sm: '58%', lg: '68%' },
                    maxWidth: { xs: 220, sm: 330, lg: 380 },
                    mt: { xs: 0.8, lg: 0.6 },
                    ml: { lg: 2.4 },
                    alignSelf: { xs: 'center', lg: 'flex-start' },
                    objectFit: 'contain',
                    mixBlendMode: 'multiply',
                    filter: 'saturate(1.04) contrast(1.02)',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              </Stack>
            </Grid>
          )}

          <Grid
            size={{ xs: 12, lg: isCompact ? 12 : 5.4 }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'center', lg: 'flex-start' },
              height: { xs: 'auto', lg: '100%' },
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: { xs: 'calc(100vw - 36px)', sm: isCompact ? 430 : 430, md: isCompact ? 440 : 460 },
                mx: { xs: 'auto', lg: 0 },
                pt: { xs: 0, lg: isCompact ? 0.6 : 0 },
                pb: { xs: 1, lg: 0 },
              }}
            >
              <Stack spacing={{ xs: 0.9, md: 1 }} alignItems="center" sx={{ mb: { xs: 1.05, md: 1.25 } }}>
                <BrandLogo
                  sx={{
                    width: { xs: 122, sm: 146, md: 154 },
                    filter: 'drop-shadow(0 10px 18px rgba(13, 27, 77, 0.08))',
                  }}
                />
                <Stack spacing={0.8} alignItems="center" textAlign="center">
                  <Typography
                    component="h2"
                    sx={{
                      fontFamily: authDisplayFont,
                      color: authPalette.navy,
                      fontSize: { xs: '1.18rem', sm: '1.44rem', md: '1.58rem' },
                      lineHeight: 1.1,
                      fontWeight: 800,
                      letterSpacing: 0,
                      maxWidth: '100%',
                      overflowWrap: 'break-word',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        background: `linear-gradient(90deg, ${authPalette.navy} 0%, ${authPalette.orange} 100%)`,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                      }}
                    >
                      {helperTitle}
                    </Box>
                  </Typography>
                  <Typography
                    sx={{
                      color: authPalette.muted,
                      fontSize: { xs: '0.82rem', sm: '0.9rem', md: '0.94rem' },
                      fontWeight: 600,
                      lineHeight: 1.38,
                      maxWidth: 310,
                    }}
                  >
                    {helperText}
                  </Typography>
                </Stack>
              </Stack>

              <Box
                sx={{
                  p: { xs: 0, sm: 0.2 },
                  borderRadius: '8px',
                  bgcolor: 'transparent',
                }}
              >
                {children}
              </Box>

              <Box
                component="span"
                sx={{
                  display: { xs: 'block', lg: 'none' },
                  mt: 2.5,
                  mx: 'auto',
                  width: 92,
                  height: 4,
                  borderRadius: 999,
                  bgcolor: alpha(brand.ink, 0.12),
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}
