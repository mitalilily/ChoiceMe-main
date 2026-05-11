import { ChevronDownIcon } from '@chakra-ui/icons'
import { Box, Button, Collapse, Flex, Stack, Text, useColorModeValue } from '@chakra-ui/react'
import React, { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { brand, brandIdentity } from 'theme/brand'

const NAVY = brand.ink
const ORANGE = brand.accent
const SKY = '#4778BD'
const TEAL = brand.success

const SidebarContent = ({ logoText, routes, sidebarWidth }) => {
  const location = useLocation()
  const [state, setState] = React.useState({})

  const sidebarBg = useColorModeValue('rgba(255,255,255,0.96)', 'rgba(13, 27, 77, 0.94)')
  const sidebarBorder = useColorModeValue('rgba(13,27,77,0.1)', 'rgba(255,255,255,0.16)')
  const sidebarShadow = useColorModeValue('14px 0 36px rgba(68, 92, 138, 0.1)', '14px 0 36px rgba(0, 0, 0, 0.38)')
  const activeBg = useColorModeValue('rgba(255,138,40,0.12)', 'rgba(255,255,255,0.12)')
  const hoverBg = useColorModeValue('rgba(13,27,77,0.04)', 'rgba(255, 255, 255, 0.08)')
  const activeBorder = useColorModeValue('rgba(255,138,40,0.2)', 'rgba(255,255,255,0.2)')
  const hoverBorder = useColorModeValue('rgba(13,27,77,0.08)', 'rgba(255,255,255,0.14)')
  const textColor = useColorModeValue('gray.700', 'gray.100')
  const iconColor = useColorModeValue('gray.500', 'gray.300')
  const dividerColor = useColorModeValue('rgba(23,19,16,0.08)', 'rgba(255,255,255,0.12)')
  const thumbColor = useColorModeValue('rgba(23,19,16,0.22)', 'rgba(255,255,255,0.24)')
  const brandText = useColorModeValue('gray.800', 'gray.100')
  const mutedText = useColorModeValue('rgba(96,115,151,0.9)', 'rgba(255,255,255,0.66)')
  const collapsedLogoBg = useColorModeValue('rgba(215,226,243,0.68)', 'rgba(44,143,255,0.18)')
  const panelBg = useColorModeValue('rgba(255,255,255,0.64)', 'rgba(255,255,255,0.06)')
  const laneColor = useColorModeValue('rgba(23,19,16,0.08)', 'rgba(255,255,255,0.12)')

  const activeRoute = (routeName) => location.pathname.startsWith(routeName)

  const toggleCollapse = (key) => {
    setState((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    routes.forEach((route) => {
      if (route.category && route.views) {
        const isChildActive = route.views.some((view) =>
          location.pathname.startsWith(view.layout + view.path.split('/:')[0]),
        )
        if (isChildActive) {
          setState((prev) => ({ ...prev, [route.state]: true }))
        }
      }
    })
  }, [location.pathname, routes])

  const collapsed = sidebarWidth <= 160
  const showText = !collapsed

  const colorForIndex = (index) => {
    const palette = [NAVY, ORANGE, SKY, TEAL]
    return palette[index % palette.length]
  }

  const renderLinkButton = (prop, isActive, index = 0) => {
    const accent = colorForIndex(index)
    return (
      <Button
        justifyContent={collapsed ? 'center' : 'flex-start'}
        w="100%"
        bg={isActive ? activeBg : 'transparent'}
        borderRadius="10px"
        mb="1.5"
        px={collapsed ? '2' : '3.5'}
        py="11px"
        h="auto"
        border="1px solid"
        borderColor={isActive ? activeBorder : 'transparent'}
        position="relative"
        boxShadow={isActive ? '0 10px 24px rgba(23,19,16,0.08)' : 'none'}
        _hover={{
          bg: hoverBg,
          transform: 'translateX(2px)',
          borderColor: hoverBorder,
        }}
        _active={{ transform: 'scale(0.98)' }}
        transition="all 0.2s ease"
      >
        <Flex align="center" gap="12px" w="100%">
          {prop.icon && (
            <Box
              w={collapsed ? '42px' : '38px'}
              h={collapsed ? '42px' : '38px'}
              borderRadius="10px"
              bg={isActive ? `${accent}22` : `${accent}14`}
              color={isActive ? accent : iconColor}
              fontSize={collapsed ? '20px' : '18px'}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              {prop.icon}
            </Box>
          )}
          {showText && (
            <Text color={isActive ? brandText : textColor} fontWeight={isActive ? '700' : '600'} fontSize="sm">
              {prop.name}
            </Text>
          )}
        </Flex>
      </Button>
    )
  }

  const renderLinks = (items) =>
    items
      .filter((prop) => prop.show !== false)
      .map((prop, index) => {
        if (prop.redirect) return null

        if (prop.category) {
          const accent = colorForIndex(index)
          const isChildActive = prop.views.some((view) =>
            location.pathname.startsWith(view.layout + view.path.split('/:')[0]),
          )

          return (
            <Box key={prop.name} mb="1">
              <Button
                onClick={() => toggleCollapse(prop.state)}
                justifyContent={collapsed ? 'center' : 'space-between'}
                w="100%"
                bg={isChildActive ? activeBg : 'transparent'}
                borderRadius="10px"
                mb="1"
                px={collapsed ? '2' : '3.5'}
                py="12px"
                h="auto"
                border="1px solid"
                borderColor={isChildActive ? activeBorder : 'transparent'}
                _hover={{
                  bg: hoverBg,
                  transform: 'translateX(2px)',
                }}
                transition="all 0.2s ease"
              >
                <Flex align="center" gap="12px" w="100%">
                  <Box
                    p="8px"
                    borderRadius="10px"
                    bg={isChildActive ? `${accent}22` : `${accent}14`}
                    color={isChildActive ? accent : iconColor}
                    fontSize={collapsed ? '20px' : '18px'}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {prop.icon}
                  </Box>
                  {showText && (
                    <Text
                      color={isChildActive ? brandText : textColor}
                      fontWeight={isChildActive ? '700' : '600'}
                      fontSize="sm"
                      textAlign="left"
                      flex="1"
                    >
                      {prop.name}
                    </Text>
                  )}
                </Flex>
                {showText && (
                  <Box
                    transition="transform 0.2s"
                    transform={state[prop.state] ? 'rotate(180deg)' : 'rotate(0deg)'}
                    color={accent}
                  >
                    <ChevronDownIcon />
                  </Box>
                )}
              </Button>
              <Collapse in={state[prop.state]} animateOpacity>
                <Box
                  pl={showText ? '18px' : '0'}
                  pr={showText ? '10px' : '0'}
                  mt="1"
                  ml={showText ? '18px' : '0'}
                  borderLeft={showText ? '1px solid' : 'none'}
                  borderColor={laneColor}
                >
                  <Stack spacing="1">{renderLinks(prop.views)}</Stack>
                </Box>
              </Collapse>
            </Box>
          )
        }

        const isActive = activeRoute(prop.layout + prop.path)
        return (
          <NavLink to={prop.layout + prop.path} key={prop.name}>
            {renderLinkButton(prop, isActive, index)}
          </NavLink>
        )
      })

  return (
    <Box
      pt="18px"
      pb="18px"
      h="100vh"
      w={`${sidebarWidth}px`}
      bg={sidebarBg}
      borderRight="1px solid"
      borderColor={sidebarBorder}
      boxShadow={sidebarShadow}
      position="fixed"
      left="0"
      top="0"
      transition="width 0.25s ease"
      overflowY="auto"
      overflowX="hidden"
      pr="2"
      backgroundImage="radial-gradient(circle at 18% 4%, rgba(255,138,40,0.1) 0%, transparent 26%), radial-gradient(circle at 88% 9%, rgba(215,226,243,0.72) 0%, transparent 24%)"
      css={{
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': { width: '5px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': {
          background: thumbColor,
          borderRadius: '4px',
        },
      }}
    >
      <Box mb="18px" px="14px" textAlign="center" transition="all 0.3s ease">
        {showText ? (
          <Box
            px="14px"
            py="14px"
            borderRadius="14px"
            bg={`linear-gradient(180deg, ${brand.ink} 0%, #163E59 100%)`}
            color="white"
            boxShadow="0 18px 36px rgba(13,27,77,0.18)"
            textAlign="left"
          >
            <Text fontSize="10px" fontWeight="800" letterSpacing="0.18em" textTransform="uppercase" color="rgba(255,255,255,0.62)" mb="8px">
              Admin cockpit
            </Text>
            <Box as="img" src={brandIdentity.logoPath} alt={brandIdentity.name} h="56px" w="168px" objectFit="contain" mb="12px" />
            <Text fontWeight="800" fontSize="16px">
              {logoText}
            </Text>
            <Text mt="6px" fontSize="11px" color="rgba(255,255,255,0.72)" lineHeight="1.6">
              {brandIdentity.tagline}
            </Text>
            <Box
              mt="12px"
              px="10px"
              py="8px"
              borderRadius="10px"
              bg="rgba(255,255,255,0.08)"
              border="1px solid rgba(255,255,255,0.1)"
            >
              <Text fontSize="11px" fontWeight="700" color="rgba(255,255,255,0.9)">
                Cleaner sections. Faster admin flow.
              </Text>
            </Box>
          </Box>
        ) : (
          <Box
            as="img"
            src={brandIdentity.logoPath}
            alt={brandIdentity.name}
            h="34px"
            w="50px"
            mx="auto"
            objectFit="contain"
            p="6px"
            borderRadius="12px"
            bg={collapsedLogoBg}
          />
        )}
      </Box>

      <Box h="1px" bg={dividerColor} mx="14px" mb="14px" />

      {showText && (
        <Text px="16px" pb="10px" fontSize="10px" fontWeight="800" letterSpacing="0.16em" textTransform="uppercase" color={mutedText}>
          Navigation
        </Text>
      )}

      <Stack direction="column" spacing="0.5" px="10px">
        <Box
          p={showText ? '10px' : '4px'}
          borderRadius="14px"
          bg={panelBg}
          border="1px solid"
          borderColor={dividerColor}
          backdropFilter="blur(12px)"
        >
          {renderLinks(routes)}
        </Box>
      </Stack>
    </Box>
  )
}

export default SidebarContent
