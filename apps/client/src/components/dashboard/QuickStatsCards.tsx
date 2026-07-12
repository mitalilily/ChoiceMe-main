import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import {
  MdAccountBalance,
  MdAccountBalanceWallet,
  MdArrowForward,
  MdLocalShipping,
  MdMarkEmailUnread,
  MdShoppingCart,
} from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { dashboardCardSx, dashboardIconSx, dashboardPalette } from './dashboardStyles'

interface QuickStatsCardsProps {
  todayOps: {
    orders: number
    pending: number
    inTransit: number
    delivered: number
  }
  financial: {
    walletBalance: number
    codRemittanceDue: number
  }
  trends: {
    ordersGrowth: number
  }
  formatCurrency: (amount: number) => string
  pendingQuickDetailsCount: number
}

export default function QuickStatsCards({
  todayOps,
  financial,
  formatCurrency,
  pendingQuickDetailsCount,
}: QuickStatsCardsProps) {
  const navigate = useNavigate()

  const stats = [
    {
      title: 'Active Shipments',
      value: todayOps.orders?.toLocaleString() || '0',
      subtitle: `${todayOps.delivered || 0} delivered today`,
      icon: <MdShoppingCart size={19} />,
      color: dashboardPalette.blue,
      onClick: () => navigate('/orders/list'),
    },
    {
      title: 'In Transit',
      value: todayOps.inTransit?.toLocaleString() || '0',
      subtitle: `${todayOps.pending || 0} pending pickup`,
      icon: <MdLocalShipping size={19} />,
      color: '#0F766E',
      onClick: () => navigate('/orders/list'),
    },
    {
      title: 'Wallet Funds',
      value: formatCurrency(financial.walletBalance || 0),
      subtitle: financial.walletBalance < 500 ? 'Recharge required' : 'Sufficient funds',
      icon: <MdAccountBalanceWallet size={19} />,
      color: dashboardPalette.amber,
      onClick: () => navigate('/billing/wallet_transactions'),
    },
    {
      title: 'COD Remittance',
      value: formatCurrency(financial.codRemittanceDue || 0),
      subtitle: 'Awaiting bank transfer',
      icon: <MdAccountBalance size={19} />,
      color: '#475569',
      onClick: () => navigate('/cod-remittance'),
    },
    {
      title: 'Customer Responses',
      value: pendingQuickDetailsCount.toLocaleString(),
      subtitle:
        pendingQuickDetailsCount > 0
          ? `${pendingQuickDetailsCount === 1 ? 'Response' : 'Responses'} ready for review`
          : 'No new responses',
      icon: <MdMarkEmailUnread size={19} />,
      color: '#6D28D9',
      onClick: () => navigate('/orders/quick-details'),
      ctaLabel: pendingQuickDetailsCount > 0 ? 'Review details' : 'Open Quick Details',
    },
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
        },
        gap: 1.6,
        mb: 2.5,
      }}
    >
      {stats.map((stat) => (
        <Card
          key={stat.title}
          onClick={stat.onClick}
          sx={{
            ...dashboardCardSx,
            minWidth: 0,
            cursor: 'pointer',
            transition: 'transform .18s ease, border-color .18s ease, box-shadow .18s ease',
            '&:hover': {
              borderColor: stat.color,
              boxShadow: '0 14px 30px rgba(15,23,42,0.09)',
              transform: 'translateY(-2px)',
            },
          }}
        >
          <CardContent
            sx={{
              p: 1.75,
              minHeight: 130,
              '&:last-child': { pb: 1.75 },
            }}
          >
            <Stack spacing={1.1} sx={{ height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: dashboardPalette.ink }}>
                  {stat.title}
                </Typography>
                <Box sx={{ ...dashboardIconSx(stat.color), width: 32, height: 32 }}>
                  {stat.icon}
                </Box>
              </Stack>

              <Box sx={{ mt: 'auto' }}>
                <Typography
                  sx={{
                    fontSize: { xs: '1.35rem', md: '1.5rem' },
                    fontWeight: 900,
                    color: dashboardPalette.ink,
                    lineHeight: 1.05,
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography
                  sx={{
                    color:
                      stat.subtitle.includes('Recharge') || stat.subtitle.includes('pending')
                        ? dashboardPalette.red
                        : stat.title === 'Customer Responses' && pendingQuickDetailsCount > 0
                          ? stat.color
                          : dashboardPalette.green,
                    fontWeight: 700,
                    fontSize: '0.71rem',
                    mt: 0.45,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {stat.subtitle}
                </Typography>
                {'ctaLabel' in stat && stat.ctaLabel ? (
                  <Button
                    size="small"
                    endIcon={<MdArrowForward size={15} />}
                    onClick={(event) => {
                      event.stopPropagation()
                      stat.onClick()
                    }}
                    sx={{
                      mt: 0.55,
                      p: 0,
                      minWidth: 0,
                      color: stat.color,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      textTransform: 'none',
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    {stat.ctaLabel}
                  </Button>
                ) : null}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  )
}
