import { Box, CircularProgress, Container, Drawer, Stack, useMediaQuery, useTheme } from '@mui/material'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { brandGradients } from '../../theme/brand'
import { DRAWER_WIDTH } from '../../utils/constants'
import Navbar from '../Navbar/Navbar'
import KeyboardShortcuts from './keyboard/KeyboardShortcuts'
import Sidebar, { COLLAPSED_WIDTH } from './Sidebar'

function ContentLoader() {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{
        minHeight: { xs: 220, md: 320 },
        color: 'primary.main',
      }}
    >
      <CircularProgress size={30} thickness={4.5} />
    </Stack>
  )
}

export default function Layout() {
  const theme = useTheme()
  const location = useLocation()
  const outlet = useOutlet()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const mainScrollRef = useRef<HTMLDivElement | null>(null)
  const [pinned, setPinned] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const routeContentKey = [location.pathname, location.search, location.hash].filter(Boolean).join(':')

  const handleDrawerToggle = () => {
    if (isMobile) setMobileOpen(!mobileOpen)
    else setPinned((prev) => !prev)
  }

  useEffect(() => {
    setMobileOpen(false)
    setHovered(false)
  }, [routeContentKey])

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, left: 0 })
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('padding-right')
  }, [routeContentKey])

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '100dvh',
        minHeight: '100dvh',
        minWidth: 0,
        overflow: 'hidden',
        backgroundImage: brandGradients.page,
      }}
    >
      <KeyboardShortcuts />

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              maxWidth: '86vw',
              top: 'var(--client-navbar-offset, 88px)',
              height: 'calc(100dvh - var(--client-navbar-offset, 88px))',
              bgcolor: '#ffffff',
              color: '#10324A',
              borderRight: '1px solid rgba(16, 50, 74, 0.08)',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              overflow: 'hidden',
            },
          }}
        >
          <Sidebar
            hovered={hovered}
            setHovered={setHovered}
            pinned
            temporary
            handleDrawerToggle={handleDrawerToggle}
            onNavigate={() => setMobileOpen(false)}
          />
        </Drawer>
      ) : (
        <Box
          sx={{
            width: pinned ? DRAWER_WIDTH : COLLAPSED_WIDTH,
            minWidth: pinned ? DRAWER_WIDTH : COLLAPSED_WIDTH,
            flexShrink: 0,
            transition: 'width 240ms ease',
            willChange: 'width',
            position: 'relative',
          }}
        >
          <Sidebar
            hovered={hovered}
            setHovered={setHovered}
            pinned={pinned}
            handleDrawerToggle={handleDrawerToggle}
          />
        </Box>
      )}

      <Stack
        sx={{
          flexGrow: 1,
          minWidth: 0,
          position: 'relative',
          height: '100dvh',
          minHeight: 0,
          overflow: 'hidden',
          bgcolor: 'transparent',
        }}
      >
        <Stack sx={{ flexGrow: 1, height: '100%', minHeight: 0, overflow: 'hidden', bgcolor: 'transparent' }}>
          <Box
            sx={{
              flexShrink: 0,
              position: 'relative',
              zIndex: (layoutTheme) => layoutTheme.zIndex.drawer + 2,
            }}
          >
            <Navbar handleDrawerToggle={handleDrawerToggle} pinned={pinned} />
          </Box>

          <Box
            component="main"
            ref={mainScrollRef}
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              bgcolor: 'transparent',
              position: 'relative',
              zIndex: 0,
              px: { xs: 1, md: 2 },
              pb: { xs: 1.5, md: 2.5 },
              height: '100%',
              minHeight: 0,
              overscrollBehavior: 'auto',
              scrollbarGutter: 'stable',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <Container
              maxWidth="xl"
              sx={{
                bgcolor: 'transparent',
                pt: 0.4,
                px: { xs: 0.5, md: 1.5 },
                overflowX: 'visible',
              }}
            >
              <Suspense fallback={<ContentLoader />}>
                <Box sx={{ display: 'contents' }}>{outlet}</Box>
              </Suspense>
            </Container>
          </Box>
        </Stack>
      </Stack>
    </Box>
  )
}
