import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Link,
  SimpleGrid,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react'
import React from 'react'
import { brand as brandTokens, brandFonts, brandGradients, brandIdentity } from '../../theme/brand'

function SignUp() {
  const pageBg = useColorModeValue(brandTokens.page, '#050B24')
  const shellBg = useColorModeValue('rgba(255,255,255,0.92)', 'rgba(13, 27, 77, 0.9)')
  const shellBorder = useColorModeValue('rgba(13,27,77,0.12)', 'rgba(26,166,247,0.18)')
  const heroBg = useColorModeValue(
    brandGradients.hero,
    'linear-gradient(180deg, rgba(13,27,77,0.94) 0%, rgba(22,62,89,0.88) 100%)',
  )
  const textPrimary = useColorModeValue(brandTokens.ink, 'whiteAlpha.900')
  const textSecondary = useColorModeValue(brandTokens.inkSoft, 'whiteAlpha.700')
  const inputBg = useColorModeValue('rgba(255,255,255,0.92)', 'rgba(7, 23, 54, 0.74)')
  const inputBorder = useColorModeValue('rgba(13,27,77,0.16)', 'rgba(26,166,247,0.2)')
  const brand = useColorModeValue(brandTokens.ink, '#8FD4FF')
  const accent = useColorModeValue(brandTokens.accent, '#FFB547')

  return (
    <Flex
      minH="100vh"
      bg={pageBg}
      align="center"
      justify="center"
      px={{ base: 4, md: 6 }}
      py={{ base: 6, md: 8 }}
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        inset="0"
        bgImage={useColorModeValue(
          brandGradients.page,
          'radial-gradient(circle at 10% 8%, rgba(26,166,247,0.18) 0%, transparent 38%), radial-gradient(circle at 94% 2%, rgba(255,138,40,0.12) 0%, transparent 28%)',
        )}
      />

      <Flex
        w="100%"
        maxW="1120px"
        bg={shellBg}
        border="1px solid"
        borderColor={shellBorder}
        borderRadius={{ base: '14px', lg: '16px' }}
        boxShadow={useColorModeValue(brandTokens.shadow, '0 28px 72px rgba(0,0,0,0.38)')}
        overflow="hidden"
        direction={{ base: 'column', lg: 'row' }}
        backdropFilter="blur(16px)"
        zIndex="1"
      >
        <Flex
          w={{ base: '100%', lg: '44%' }}
          bg={heroBg}
          color={textPrimary}
          p={{ base: 6, md: 8 }}
          direction="column"
          justify="space-between"
          minH={{ base: '240px', lg: 'unset' }}
          position="relative"
          overflow="hidden"
          borderRight={{ base: 'none', lg: '1px solid rgba(13,27,77,0.08)' }}
        >
          <VStack align="flex-start" spacing={5} position="relative" zIndex="1">
            <Box as="img" src={brandIdentity.logoPath} alt={brandIdentity.name} h="62px" w="224px" objectFit="contain" />
            <Heading
              fontFamily={brandFonts.display}
              fontSize={{ base: '3xl', md: '5xl' }}
              fontWeight="800"
              lineHeight="0.98"
              letterSpacing="-0.04em"
            >
              Launch dispatch
              <Text as="span" display="block" color={brand}>
                workflows with speed.
              </Text>
            </Heading>
            <Text color={textSecondary} fontSize="sm" maxW="360px" lineHeight="1.8">
              Create a ChoiceMe Logistics workspace for teams that need cleaner shipment
              control, billing visibility, and faster daily operations.
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} pt={{ base: 5, lg: 0 }}>
            {[
              { value: 'B2C', label: 'shipments ready' },
              { value: 'B2B', label: 'lanes supported' },
              { value: 'Fast', label: 'branding system' },
            ].map((item) => (
              <Box
                key={item.label}
                px={4}
                py={3}
                borderRadius="10px"
                bg={useColorModeValue('rgba(255,255,255,0.68)', 'rgba(255,255,255,0.06)')}
                border={`1px solid ${useColorModeValue('rgba(13,27,77,0.14)', 'rgba(255,255,255,0.14)')}`}
              >
                <Text fontSize="lg" fontWeight="800" color={accent} lineHeight="1">
                  {item.value}
                </Text>
                <Text mt={1} fontSize="xs" color={textSecondary}>
                  {item.label}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Flex>

        <Flex w={{ base: '100%', lg: '56%' }} align="center" justify="center" px={{ base: 5, md: 8 }} py={{ base: 7, md: 9 }}>
          <Box w="100%" maxW="460px">
            <VStack spacing={6} align="stretch">
              <Box>
                <Text fontSize="xs" fontWeight="800" letterSpacing="0.7px" color={brand} mb={2}>
                  DELIVER FASTER
                </Text>
                <Heading
                  fontFamily={brandFonts.display}
                  fontSize={{ base: '2xl', md: '4xl' }}
                  fontWeight="800"
                  color={textPrimary}
                  lineHeight="1.02"
                  letterSpacing="-0.04em"
                >
                  Create your admin workspace
                </Heading>
                <Text mt={2} color={textSecondary} fontSize="sm" lineHeight="1.8">
                  Use this setup form to onboard your ChoiceMe operations team.
                </Text>
              </Box>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="700" color={textPrimary}>
                    Full Name
                  </FormLabel>
                  <Input
                    placeholder="Operations manager"
                    h="52px"
                    borderRadius="10px"
                    bg={inputBg}
                    borderColor={inputBorder}
                    _focus={{ borderColor: 'accent.500', boxShadow: '0 0 0 4px rgba(255,138,40,0.16)' }}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="700" color={textPrimary}>
                    Company
                  </FormLabel>
                  <Input
                    placeholder="ChoiceMe operations"
                    h="52px"
                    borderRadius="10px"
                    bg={inputBg}
                    borderColor={inputBorder}
                    _focus={{ borderColor: 'accent.500', boxShadow: '0 0 0 4px rgba(255,138,40,0.16)' }}
                  />
                </FormControl>
              </SimpleGrid>

              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="700" color={textPrimary}>
                  Work Email
                </FormLabel>
                <Input
                  type="email"
                  placeholder="team@company.com"
                  h="52px"
                  borderRadius="10px"
                  bg={inputBg}
                  borderColor={inputBorder}
                  _focus={{ borderColor: 'accent.500', boxShadow: '0 0 0 4px rgba(255,138,40,0.16)' }}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="700" color={textPrimary}>
                  Password
                </FormLabel>
                <Input
                  type="password"
                  placeholder="Create a secure password"
                  h="52px"
                  borderRadius="10px"
                  bg={inputBg}
                  borderColor={inputBorder}
                  _focus={{ borderColor: 'accent.500', boxShadow: '0 0 0 4px rgba(255,138,40,0.16)' }}
                />
              </FormControl>

              <Checkbox colorScheme="green" defaultChecked>
                <Text fontSize="sm" color={textSecondary}>
                  Keep me signed in on this device
                </Text>
              </Checkbox>

              <Button
                h="52px"
                borderRadius="10px"
                bg={brandGradients.button}
                color="white"
                fontWeight="700"
                _hover={{ boxShadow: '0 20px 36px rgba(255, 122, 21, 0.28)', transform: 'translateY(-1px)' }}
                _active={{ transform: 'translateY(0)' }}
              >
                Start with ChoiceMe
              </Button>

              <Text color={textSecondary} fontWeight="medium" textAlign="center">
                Already have access?
                <Link color={brand} ms="5px" href={`${process.env.PUBLIC_URL}/#/auth/signin`} fontWeight="bold">
                  Sign in
                </Link>
              </Text>
            </VStack>
          </Box>
        </Flex>
      </Flex>
    </Flex>
  )
}

export default SignUp
