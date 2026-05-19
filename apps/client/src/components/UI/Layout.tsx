import { Box, Container, Drawer, Stack, useMediaQuery, useTheme } from '@mui/material'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { brandGradients } from '../../theme/brand'
import { DRAWER_WIDTH } from '../../utils/constants'
import Navbar from '../Navbar/Navbar'
import KeyboardShortcuts from './keyboard/KeyboardShortcuts'
import FullScreenLoader from './loader/FullScreenLoader'
import Sidebar, { COLLAPSED_WIDTH } from './Sidebar'

export default function Layout() {
  const theme = useTheme()
  const location = useLocation()
  const outlet = useOutlet()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const mainScrollRef = useRef<HTMLDivElement | null>(null)
  const [pinned, setPinned] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const routeContentKey = [location.key, location.pathname, location.search, location.hash]
    .filter(Boolean)
    .join(':')

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
              bgcolor: '#ffffff',
              color: '#10324A',
              borderRight: '1px solid rgba(16, 50, 74, 0.08)',
            },
          }}
        >
          <Sidebar
            hovered={hovered}
            setHovered={setHovered}
            pinned
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
          <Navbar handleDrawerToggle={handleDrawerToggle} pinned={pinned} />

          <Box
            component="main"
            ref={mainScrollRef}
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              bgcolor: 'transparent',
              px: { xs: 1, md: 2 },
              pb: { xs: 1.5, md: 2.5 },
              height: '100%',
              minHeight: 0,
              overscrollBehavior: 'contain',
              scrollBehavior: 'smooth',
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
                overflowX: 'hidden',
              }}
            >
              <Suspense fallback={<FullScreenLoader />}>
                <Box key={routeContentKey} sx={{ display: 'contents' }}>
                  {outlet}
                </Box>
              </Suspense>
            </Container>
          </Box>
        </Stack>
      </Stack>
    </Box>
  )
}
