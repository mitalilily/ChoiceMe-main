import { Box, type BoxProps } from '@mui/material'
import BrandSurface from './BrandSurface'

interface BrandTopBarProps extends BoxProps {
  innerSx?: BoxProps['sx']
}

export default function BrandTopBar({
  children,
  sx,
  innerSx,
  ...rest
}: BrandTopBarProps) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1200,
        px: { xs: 2, sm: 3 },
        py: { xs: 1.2, sm: 1.4 },
        ...sx,
      }}
      {...rest}
    >
      <BrandSurface
        variant="glass"
        sx={{
          px: { xs: 2, sm: 2.5, lg: 3 },
          py: { xs: 0.95, sm: 1.1 },
          borderRadius: { xs: '14px', sm: '14px' },
          ...innerSx,
        }}
      >
        {children}
      </BrandSurface>
    </Box>
  )
}
