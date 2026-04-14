import { Box, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import BrandSurface from '../brand/BrandSurface'
import { brand } from '../../theme/brand'

interface AuthCodePreviewProps {
  title: string
  code: string
}

export default function AuthCodePreview({ title, code }: AuthCodePreviewProps) {
  if (!code) return null

  return (
    <BrandSurface
      variant="soft"
      sx={{
        p: 1.6,
        borderRadius: '24px',
        border: `1px solid ${alpha(brand.warning, 0.22)}`,
        background: 'linear-gradient(180deg, rgba(255,248,239,0.96) 0%, rgba(255,255,255,0.98) 100%)',
      }}
    >
      <Stack spacing={1}>
        <Typography sx={{ color: brand.ink, fontWeight: 700, lineHeight: 1.15 }}>{title}</Typography>

        <Box
          sx={{
            px: 1.3,
            py: 1.2,
            borderRadius: '18px',
            bgcolor: alpha('#FFFFFF', 0.8),
            border: `1px dashed ${alpha(brand.ink, 0.18)}`,
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              color: brand.ink,
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
              letterSpacing: '0.34em',
              textAlign: 'center',
              pl: '0.34em',
            }}
          >
            {code}
          </Typography>
        </Box>
      </Stack>
    </BrandSurface>
  )
}
