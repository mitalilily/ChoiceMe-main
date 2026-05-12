import { alpha, type SxProps, type Theme } from '@mui/material/styles'
import { brand } from '../../theme/brand'

export const dashboardPalette = {
  page: '#FFF8F2',
  surface: '#FFFFFF',
  tile: '#FFF4EA',
  ink: '#111827',
  muted: '#64748B',
  line: '#F0DCCB',
  orange: brand.accent,
  orangeDark: '#E67213',
  orangeSoft: '#FFF3EA',
  blue: brand.accent,
  blueDark: '#E67213',
  green: '#16A34A',
  amber: '#F59E0B',
  red: '#DC2626',
}

export const dashboardCardSx = {
  height: '100%',
  borderRadius: '16px',
  position: 'relative',
  border: `1px solid ${alpha(dashboardPalette.orange, 0.18)}`,
  background: `linear-gradient(180deg, #FFFFFF 0%, ${alpha(dashboardPalette.orange, 0.035)} 100%)`,
  boxShadow: `0 16px 36px ${alpha(dashboardPalette.orange, 0.08)}, 0 14px 34px rgba(15, 23, 42, 0.045)`,
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: `linear-gradient(90deg, ${dashboardPalette.orange} 0%, ${brand.gold} 100%)`,
    opacity: 0.88,
  },
} satisfies SxProps<Theme>

export const dashboardTileSx = (color = dashboardPalette.orange) => ({
  borderRadius: '12px',
  border: `1px solid ${alpha(color, 0.16)}`,
  backgroundColor: alpha(color, 0.055),
}) satisfies SxProps<Theme>

export const dashboardIconSx = (color = dashboardPalette.orange) => ({
  width: 36,
  height: 36,
  borderRadius: '10px',
  display: 'grid',
  placeItems: 'center',
  color,
  background: `linear-gradient(135deg, ${alpha(color, 0.14)} 0%, ${alpha(brand.gold, 0.16)} 100%)`,
  border: `1px solid ${alpha(color, 0.16)}`,
  flex: '0 0 auto',
}) satisfies SxProps<Theme>

export const dashboardButtonSx = {
  borderRadius: '10px',
  minHeight: 38,
  px: 1.8,
  boxShadow: 'none',
  textTransform: 'none',
  fontWeight: 800,
  '&:hover': {
    boxShadow: `0 12px 26px ${alpha(dashboardPalette.orange, 0.16)}`,
  },
} satisfies SxProps<Theme>

export const dashboardChartBase = {
  fontFamily: 'Inter, Poppins, sans-serif',
  toolbar: { show: false },
  animations: { enabled: false },
}

export const dashboardText = {
  title: brand.ink || dashboardPalette.ink,
  muted: brand.inkSoft || dashboardPalette.muted,
}
