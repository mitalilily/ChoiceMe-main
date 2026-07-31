'use client'

import {
  Badge,
  Box,
  Container,
  Flex,
  Grid,
  HStack,
  Icon,
  Spinner,
  Text,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react'
import {
  FaBoxOpen,
  FaBuilding,
  FaExclamationTriangle,
  FaShippingFast,
  FaStore,
  FaTruck,
} from 'react-icons/fa'
import { getCourierDisplayName } from 'utils/courierDisplay'

const stages = [
  { label: 'Booked', icon: FaStore },
  { label: 'Pending Pickup', icon: FaBuilding },
  { label: 'In Transit', icon: FaTruck },
  { label: 'Out for Delivery', icon: FaShippingFast },
  { label: 'Delivered', icon: FaBoxOpen },
]

const statusLabels = {
  pending: 'Pending',
  booked: 'Booked',
  manifest_generated: 'Manifest Generated',
  shipment_created: 'Shipment Created',
  pickup_initiated: 'Pickup Initiated',
  PP: 'Pending Pickup',
  IT: 'In Transit',
  OFD: 'Out for Delivery',
  DL: 'Delivered',
  CAN: 'Cancelled',
  RT: 'RTO',
  'RT-IT': 'RTO In Transit',
  'RT-DL': 'RTO Delivered',
  EX: 'Exception',
  ndr: 'NDR',
  rto_initiated: 'RTO Initiated',
  rto_in_transit: 'RTO In Transit',
  rto_delivered: 'RTO Delivered',
}

const normalizeTrackingStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const formatTrackingStatus = (status) => {
  const normalized = normalizeTrackingStatus(status)
  return statusLabels[normalized] || statusLabels[normalized?.toUpperCase?.()] || status || 'Unknown'
}

const formatTrackingDate = (value) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

const formatTrackingTime = (value) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

const getTrackingTone = (status) => {
  const normalized = normalizeTrackingStatus(status)
  if (normalized.includes('deliver')) return { bg: 'green.100', fg: 'green.700' }
  if (normalized.includes('transit')) return { bg: 'blue.100', fg: 'blue.700' }
  if (normalized.includes('cancel') || normalized.includes('failed'))
    return { bg: 'red.100', fg: 'red.700' }
  if (normalized.includes('rto') || normalized.includes('ndr'))
    return { bg: 'orange.100', fg: 'orange.700' }

  return { bg: 'gray.100', fg: 'gray.700' }
}

export default function TrackingDetails({ data, isLoading, error }) {
  const cardBg = useColorModeValue('white', 'gray.800')
  const detailItemBg = useColorModeValue('gray.50', 'gray.700')
  const historyBorderColor = useColorModeValue('gray.200', 'gray.600')
  console.log(data)
  if (isLoading) {
    return (
      <Flex direction="column" align="center" justify="center" py={12}>
        <Spinner size="xl" thickness="4px" color="blue.500" />
        <Text mt={4} fontWeight="medium">
          Fetching your tracking details…
        </Text>
      </Flex>
    )
  }

  if (error || !data) {
    return (
      <Box bg="red.50" border="1px" borderColor="red.200" rounded="lg" p={6} textAlign="center">
        <Icon as={FaExclamationTriangle} boxSize={10} color="red.500" mb={2} />
        <Text fontWeight="bold" fontSize="lg" color="red.700">
          {error ? 'Something went wrong' : 'Tracking Not Found'}
        </Text>
        <Text fontSize="sm" mt={1} color="red.600">
          {error?.message || 'Please check your AWB / Order details and try again.'}
        </Text>
      </Box>
    )
  }

  const currentStage =
    Math.max(
      0,
      data?.history?.findIndex(
        (h) =>
          normalizeTrackingStatus(formatTrackingStatus(h.status_code)) ===
          normalizeTrackingStatus(data.status),
      ) ?? 0,
    )

  return (
    <Container maxW="6xl" py={8}>
      <Grid templateColumns={{ base: '1fr', md: '1fr 2fr' }} gap={6}>
        {/* Shipment Details */}
        <Box bg={cardBg} rounded="lg" shadow="md" p={6}>
          <Text fontSize="xl" fontWeight="bold" mb={4}>
            Shipment Details
          </Text>
          <VStack spacing={3} align="stretch">
            {[
              { label: 'Courier', value: getCourierDisplayName(data.courier_name) },
              { label: 'AWB No', value: data.awb_number },
              { label: 'Order Number', value: data.order_number },
              { label: 'Payment Type', value: data.payment_type },
              { label: 'Expected Delivery', value: data.edd },
            ].map((item) => (
              <Box
                key={item.label}
                p={3}
                rounded="md"
                bg={detailItemBg}
              >
                <Text fontSize="xs" textTransform="uppercase" color="gray.500">
                  {item.label}
                </Text>
                <Text fontWeight="semibold">{item.value || '-'}</Text>
              </Box>
            ))}
          </VStack>
        </Box>

        {/* Tracking Progress + History */}
        <VStack spacing={6} align="stretch">
          {/* Progress */}
          <Box bg={cardBg} rounded="lg" shadow="md" p={6}>
            <HStack justify="space-between">
              {stages.map((stage, index) => {
                const active = index <= currentStage
                return (
                  <VStack key={stage.label} spacing={2}>
                    <Flex
                      w={10}
                      h={10}
                      rounded="full"
                      align="center"
                      justify="center"
                      bg={active ? 'blue.500' : 'gray.300'}
                      color="white"
                    >
                      <Icon as={stage.icon} />
                    </Flex>
                    <Text
                      fontSize="xs"
                      fontWeight={active ? 'bold' : 'normal'}
                      color={active ? 'blue.600' : 'gray.500'}
                      textAlign="center"
                    >
                      {stage.label}
                    </Text>
                  </VStack>
                )
              })}
            </HStack>
          </Box>

          {/* History */}
          <Box bg={cardBg} rounded="lg" shadow="md" p={6}>
            <Text fontSize="lg" fontWeight="bold" mb={4}>
              Tracking History
            </Text>
            <VStack spacing={4} align="stretch">
              {data.history.map((h, idx) => {
                const exactStatus = formatTrackingStatus(h.status_code)
                const tone = getTrackingTone(h.status_code)
                const isLatest = idx === 0

                return (
                  <Box
                    key={idx}
                    p={4}
                    border="1px"
                    borderColor={historyBorderColor}
                    rounded="xl"
                    bg={isLatest ? 'orange.50' : cardBg}
                  >
                    <Grid templateColumns={{ base: '1fr', md: '160px 20px 1fr' }} gap={4} alignItems="start">
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" color="gray.700">
                          {formatTrackingDate(h.event_time)}
                        </Text>
                        <Text fontSize="xs" color="gray.500" fontWeight="semibold">
                          {formatTrackingTime(h.event_time)}
                        </Text>
                      </Box>

                      <Box display={{ base: 'none', md: 'block' }} pt={1}>
                        <Box
                          w="12px"
                          h="12px"
                          borderRadius="full"
                          bg={isLatest ? 'orange.400' : 'gray.300'}
                          boxShadow={isLatest ? '0 0 0 6px rgba(249, 115, 22, 0.12)' : 'none'}
                          position="relative"
                        >
                          {idx < data.history.length - 1 && (
                            <Box
                              position="absolute"
                              left="5px"
                              top="12px"
                              bottom="-28px"
                              w="2px"
                              bg="gray.200"
                            />
                          )}
                        </Box>
                      </Box>

                      <Box>
                        <HStack spacing={2} align="center" flexWrap="wrap">
                          <Badge bg={tone.bg} color={tone.fg} px={2} py={1} borderRadius="full">
                            {exactStatus}
                          </Badge>
                          <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase">
                            Exact Status
                          </Text>
                        </HStack>

                        <Text fontSize="sm" mt={2} fontWeight="semibold" color="gray.700">
                          {h.message || exactStatus}
                        </Text>

                        <Text fontSize="sm" mt={1} color="gray.600">
                          <strong>Location:</strong> {h.location || 'N/A'}
                        </Text>
                      </Box>
                    </Grid>
                  </Box>
                )
              })}
            </VStack>
          </Box>
        </VStack>
      </Grid>
    </Container>
  )
}
