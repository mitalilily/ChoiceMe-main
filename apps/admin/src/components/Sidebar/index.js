import { Box } from '@chakra-ui/react'
import React from 'react'
import { brandIdentity } from 'theme/brand'
import SidebarContent from './SidebarContent'

function Sidebar(props) {
  const mainPanel = React.useRef()
  const { logoText, routes, sidebarVariant, sidebarWidth } = props

  return (
    <Box ref={mainPanel}>
      <Box display={{ sm: 'none', xl: 'block' }} position="fixed" top="0" left="0" h="100vh" pointerEvents="none">
        <Box
          pointerEvents="auto"
          w={`${sidebarWidth}px`}
          maxW="400px"
          minW="220px"
          ms={{ sm: '18px' }}
          my={{ sm: '18px' }}
          h="calc(100vh - 36px)"
          borderRadius="16px"
          background="linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,254,0.9) 100%)"
          border="1px solid rgba(13,27,77,0.1)"
          boxShadow="0 28px 60px rgba(68,92,138,0.14)"
          overflow="hidden"
          position="relative"
        >
          <SidebarContent
            sidebarWidth={sidebarWidth}
            routes={routes}
            logoText={logoText || brandIdentity.name}
            sidebarVariant={sidebarVariant}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default Sidebar
