import {
  Box,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import React from 'react'
import { IoCloseCircleOutline } from 'react-icons/io5'

interface GlassDrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  width?: number | string
  anchor?: 'left' | 'right'
  children: React.ReactNode
  presentation?: 'drawer' | 'dialog'
}

const CustomDrawer: React.FC<GlassDrawerProps> = ({
  open,
  onClose,
  title,
  width = 420,
  anchor = 'right',
  children,
  presentation = 'drawer',
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (presentation === 'dialog') return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" fullScreen={isMobile}
      slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3, maxHeight: isMobile ? '100dvh' : '92dvh', bgcolor: '#fff', backgroundImage: 'none' } }, backdrop: { sx: { bgcolor: 'rgba(17,24,39,.5)', backdropFilter: 'blur(4px)' } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E5E9EF', py: 1.75, px: { xs: 2, sm: 3 } }}>
        <Box><Typography fontWeight={800} color="#102A54">{title}</Typography><Typography variant="caption" color="text.secondary">Customer, order and package details</Typography></Box>
        <IconButton aria-label="Close order form" onClick={onClose}><IoCloseCircleOutline size={24} /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 1, sm: 2 }, bgcolor: '#F8FAFC', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>{children}</DialogContent>
    </Dialog>
  )

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: isMobile ? '100%' : width,
            maxWidth: '100vw',
            height: '100dvh',
            maxHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            color: theme.palette.text.primary,
            overflow: 'hidden',
            touchAction: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: `
              radial-gradient(circle at top left, ${alpha(theme.palette.primary.light, 0.2)} 0%, transparent 28%),
              radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.16)} 0%, transparent 24%),
              linear-gradient(180deg, rgba(255, 251, 245, 0.98) 0%, rgba(255, 246, 236, 0.96) 100%)
            `,
            borderLeft: anchor === 'right' ? `1px solid ${alpha(theme.palette.primary.main, 0.12)}` : 'none',
            borderRight: anchor === 'left' ? `1px solid ${alpha(theme.palette.primary.main, 0.12)}` : 'none',
            boxShadow: `0 32px 72px ${alpha(theme.palette.text.primary, 0.16)}`,
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          px: { xs: 2.5, sm: 3.5 },
          py: { xs: 2.25, sm: 2.8 },
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: '0 auto auto 0',
            width: 120,
            height: 120,
            background: alpha(theme.palette.secondary.main, 0.18),
            filter: 'blur(44px)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 'auto 0 0 auto',
            width: 140,
            height: 140,
            background: alpha(theme.palette.primary.light, 0.18),
            filter: 'blur(50px)',
          }}
        />

        <Box display="flex" alignItems="center" justifyContent="space-between" position="relative" zIndex={1}>
          <Box>
            <Typography
              sx={{
                fontSize: '0.74rem',
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                fontWeight: 800,
                color: theme.palette.text.secondary,
                mb: 0.5,
              }}
            >
              ChoiceMee workspace
            </Typography>
            <Typography variant="h6" fontWeight={800} color={theme.palette.text.primary}>
              {title}
            </Typography>
          </Box>

          <IconButton
            onClick={onClose}
            sx={{
              color: theme.palette.primary.main,
              backgroundColor: alpha('#ffffff', 0.7),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                transform: 'rotate(90deg)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            <IoCloseCircleOutline size={24} />
          </IconButton>
        </Box>
      </Box>

      <Divider sx={{ borderColor: alpha(theme.palette.primary.main, 0.08) }} />

      <Box
        p={{ xs: 2.5, sm: 3.5 }}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'auto',
          scrollbarGutter: 'stable',
          backgroundColor: alpha('#ffffff', 0.42),
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: alpha(theme.palette.primary.main, 0.05),
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.primary.main, 0.28),
            borderRadius: '999px',
          },
        }}
      >
        {children}
      </Box>
    </Drawer>
  )
}

export default CustomDrawer


