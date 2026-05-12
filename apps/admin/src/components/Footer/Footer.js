import { Box, Flex, Link, Text, useColorModeValue } from '@chakra-ui/react'

export default function Footer() {
  const textColor = useColorModeValue('rgba(96,115,151,0.94)', 'gray.400')
  const linkColor = useColorModeValue('accent.600', 'accent.300')
  const borderColor = useColorModeValue('rgba(13,27,77,0.08)', 'rgba(255,255,255,0.08)')

  return (
    <Flex
      flexDirection={{ base: 'column', xl: 'row' }}
      alignItems={{ base: 'center', xl: 'center' }}
      justifyContent="space-between"
      px="30px"
      py="22px"
      w="100%"
      mt="16px"
    >
      <Box
        px="18px"
        py="14px"
        borderRadius="20px"
        border="1px solid"
        borderColor={borderColor}
        bg={useColorModeValue('rgba(255,255,255,0.74)', 'rgba(15,27,45,0.72)')}
      >
        <Text
          color={textColor}
          textAlign={{ base: 'center', xl: 'start' }}
          fontSize="sm"
        >
          crafted by
          <Link
            color={linkColor}
            href="https://searchcraftdigital.com/"
            target="_blank"
            rel="noopener noreferrer"
            fontWeight="semibold"
            ms="6px"
          >
            SearchCraft Digital
          </Link>
        </Text>
      </Box>
    </Flex>
  )
}
