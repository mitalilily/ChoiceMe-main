import { Box, ChakraProvider, Portal, useColorModeValue, useDisclosure } from '@chakra-ui/react'
import Configurator from 'components/Configurator/Configurator'
import Footer from 'components/Footer/Footer.js'
import AdminNavbar from 'components/Navbars/AdminNavbar.js'
import { RouteAssetRecovery, RouteErrorBoundary } from 'components/RouteRecovery/RouteErrorBoundary'
import Sidebar from 'components/Sidebar'
import { useEffect, useState } from 'react'
import { Redirect, Route, Switch, useLocation } from 'react-router-dom'
import routes from 'routes.js'
import theme from 'theme/theme.js'
import FixedPlugin from '../components/FixedPlugin/FixedPlugin'
import MainPanel from '../components/Layout/MainPanel'
import PanelContainer from '../components/Layout/PanelContainer'
import PanelContent from '../components/Layout/PanelContent'
import { brandIdentity } from '../theme/brand'

export default function Dashboard(props) {
  const { ...rest } = props
  const location = useLocation()
  const [sidebarVariant, setSidebarVariant] = useState('transparent')
  const [fixed, setFixed] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(292)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const newWidth = Math.min(Math.max(e.clientX, 240), 360)
        setSidebarWidth(newWidth)
      }
    }
    const handleMouseUp = () => setIsResizing(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const getRoute = () => window.location.pathname !== '/admin/full-screen-maps'

  const getActiveRoute = (allRoutes) => {
    let activeRoute = 'Default Brand Text'
    for (let i = 0; i < allRoutes.length; i++) {
      if (allRoutes[i].collapse || allRoutes[i].category) {
        const nestedRoute = getActiveRoute(allRoutes[i].views)
        if (nestedRoute !== activeRoute) return nestedRoute
      } else if (window.location.href.indexOf(allRoutes[i].layout + allRoutes[i].path) !== -1) {
        return allRoutes[i].name
      }
    }
    return activeRoute
  }

  const getActiveNavbar = (allRoutes) => {
    let activeNavbar = false
    for (let i = 0; i < allRoutes.length; i++) {
      if (allRoutes[i].category) {
        const categoryNavbar = getActiveNavbar(allRoutes[i].views)
        if (categoryNavbar !== activeNavbar) return categoryNavbar
      } else if (window.location.href.indexOf(allRoutes[i].layout + allRoutes[i].path) !== -1) {
        if (allRoutes[i].secondaryNavbar) return allRoutes[i].secondaryNavbar
      }
    }
    return activeNavbar
  }

  const getRoutes = (allRoutes) =>
    allRoutes.map((prop, key) => {
      if (prop.collapse || prop.category) return getRoutes(prop.views)
      if (prop.layout === '/admin') {
        return <Route path={prop.layout + prop.path} component={prop.component} key={key} />
      }
      return null
    })

  const { isOpen, onOpen, onClose } = useDisclosure()
  const resizeActiveBg = useColorModeValue('rgba(13,27,77,0.16)', 'rgba(255,255,255,0.18)')
  const resizeHoverBg = useColorModeValue('rgba(13,27,77,0.12)', 'rgba(255,255,255,0.14)')
  document.documentElement.dir = 'ltr'

  return (
    <ChakraProvider theme={theme} resetCss={false}>
      <RouteAssetRecovery />
      <Sidebar
        routes={routes}
        logoText={brandIdentity.name}
        sidebarVariant={sidebarVariant}
        sidebarWidth={sidebarWidth}
        {...rest}
      />

      <MainPanel
        w={{
          base: '100%',
          xl: `calc(100% - ${sidebarWidth}px)`,
        }}
        ml={{ xl: `${sidebarWidth}px` }}
      >
        <Portal>
          <AdminNavbar
            onOpen={onOpen}
            logoText={brandIdentity.name}
            brandText={getActiveRoute(routes)}
            secondary={getActiveNavbar(routes)}
            fixed={fixed}
            sidebarWidth={sidebarWidth}
            {...rest}
          />
        </Portal>
        {getRoute() ? (
          <PanelContent>
            <PanelContainer>
              <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`}>
                <Switch>
                  {getRoutes(routes)}
                  <Redirect from="/admin" to="/admin/dashboard" />
                </Switch>
              </RouteErrorBoundary>
            </PanelContainer>
          </PanelContent>
        ) : null}
        <Footer />
        <Portal>
          <FixedPlugin secondary={getActiveNavbar(routes)} fixed={fixed} onOpen={onOpen} />
        </Portal>
        <Configurator
          secondary={getActiveNavbar(routes)}
          isOpen={isOpen}
          onClose={onClose}
          isChecked={fixed}
          onSwitch={(value) => setFixed(value)}
          onOpaque={() => setSidebarVariant('opaque')}
          onTransparent={() => setSidebarVariant('transparent')}
        />
      </MainPanel>

      <Box
        position="fixed"
        left={`${sidebarWidth - 2}px`}
        top="0"
        h="100vh"
        w="4px"
        cursor="col-resize"
        zIndex="1400"
        bg={isResizing ? resizeActiveBg : 'transparent'}
        _hover={{ bg: resizeHoverBg }}
        onMouseDown={() => setIsResizing(true)}
      />
    </ChakraProvider>
  )
}
