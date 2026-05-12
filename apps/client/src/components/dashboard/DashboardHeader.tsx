import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { MdDashboardCustomize, MdRefresh } from 'react-icons/md'
import { dashboardButtonSx, dashboardIconSx, dashboardPalette } from './dashboardStyles'

interface DashboardHeaderProps {
  isRefetching: boolean
  onRefresh: () => void
  onCustomize?: () => void
}

export default function DashboardHeader({
  isRefetching,
  onRefresh,
  onCustomize,
}: DashboardHeaderProps) {
  return (
    <Box
      sx={{
        mb: 2.5,
        p: { xs: 2, md: 2.4 },
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        border: `1px solid ${alpha(dashboardPalette.orange, 0.18)}`,
        background: `
          radial-gradient(circle at 0% 0%, ${alpha(dashboardPalette.orange, 0.14)} 0%, transparent 34%),
          linear-gradient(135deg, #FFFFFF 0%, ${alpha(dashboardPalette.orange, 0.08)} 100%)
        `,
        boxShadow: `0 18px 40px ${alpha(dashboardPalette.orange, 0.1)}, 0 14px 34px rgba(15,23,42,0.045)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${dashboardPalette.orange} 0%, #FFB15A 100%)`,
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        gap={1.5}
      >
        <Stack direction="row" spacing={1.4} alignItems="center">
          <Box sx={dashboardIconSx(dashboardPalette.orange)}>
            <MdDashboardCustomize size={19} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: { xs: '1.35rem', md: '1.8rem' },
                fontWeight: 900,
                background: `linear-gradient(90deg, ${dashboardPalette.ink} 0%, ${dashboardPalette.orange} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Dashboard
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: dashboardPalette.muted, fontWeight: 500 }}>
              A sharper orange-tinted view of orders, cash flow, courier health, and action queues.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {onCustomize && (
            <Button
              onClick={onCustomize}
              variant="outlined"
              startIcon={<MdDashboardCustomize size={18} />}
              sx={{
                ...dashboardButtonSx,
                borderColor: alpha(dashboardPalette.orange, 0.32),
                color: dashboardPalette.orangeDark,
                backgroundColor: alpha('#FFFFFF', 0.86),
                '&:hover': {
                  borderColor: dashboardPalette.orange,
                  backgroundColor: alpha(dashboardPalette.orange, 0.08),
                },
              }}
            >
              Customize
            </Button>
          )}

          <Button
            onClick={onRefresh}
            disabled={isRefetching}
            variant="contained"
            startIcon={
              isRefetching ? (
                <CircularProgress size={14} thickness={4} sx={{ color: '#FFFFFF' }} />
              ) : (
                <MdRefresh size={18} />
              )
            }
            sx={{
              ...dashboardButtonSx,
              background: `linear-gradient(135deg, ${dashboardPalette.orange} 0%, #FFB15A 100%)`,
              color: '#FFFFFF',
              '&:hover': {
                background: `linear-gradient(135deg, ${dashboardPalette.orangeDark} 0%, ${dashboardPalette.orange} 100%)`,
                boxShadow: `0 12px 26px ${alpha(dashboardPalette.orange, 0.22)}`,
              },
            }}
          >
            {isRefetching ? 'Updating' : 'Refresh'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
