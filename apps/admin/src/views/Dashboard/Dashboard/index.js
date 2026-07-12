import {
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import { useDashboardStats } from 'hooks/useDashboardStats'
import { useMemo, useState } from 'react'
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiMapPin,
  FiPackage,
  FiRefreshCw,
  FiTruck,
  FiUserPlus,
} from 'react-icons/fi'
import { useHistory } from 'react-router-dom'

const CARD_ACCENTS = {
  ndr: { bg: '#FFF5F5', border: '#FECACA', icon: '#DC2626' },
  delivered: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#15803D' },
  shipped: { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB' },
  revenue: { bg: '#ECFDF5', border: '#A7F3D0', icon: '#047857' },
  todayOrders: { bg: '#FFF7ED', border: '#FED7AA', icon: '#EA580C' },
  todayManifest: { bg: '#F5F3FF', border: '#DDD6FE', icon: '#7C3AED' },
  todayDelivery: { bg: '#ECFDF5', border: '#A7F3D0', icon: '#059669' },
  todayNdr: { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626' },
}

const CARD_ICONS = {
  ndr: FiAlertTriangle,
  delivered: FiCheckCircle,
  shipped: FiTruck,
  revenue: FiDollarSign,
  todayOrders: FiPackage,
  todayManifest: FiTruck,
  todayDelivery: FiCheckCircle,
  todayNdr: FiAlertTriangle,
}

const formatDateLabel = (value) => {
  if (!value) return 'Today'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatShortDateTime = (value) => {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)

function ShipmentDetailsModal({ group, title, isOpen, onClose }) {
  const textPrimary = useColorModeValue('#111827', 'white')
  const textMuted = useColorModeValue('#64748B', 'gray.400')
  const lineColor = useColorModeValue('#E2E8F0', 'whiteAlpha.200')
  const softBg = useColorModeValue('#F8FAFC', 'whiteAlpha.100')

  if (!group) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="24px" overflow="hidden">
        <ModalHeader pb={3}>
          <Stack spacing={2}>
            <Text fontSize="lg" fontWeight="800" color={textPrimary}>
              {group.sellerName}
            </Text>
            <Text fontSize="sm" color={textMuted}>
              {title} • {group.shipmentCount} shipment{group.shipmentCount === 1 ? '' : 's'}
            </Text>
          </Stack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} mb={5}>
            <Box p={3.5} bg={softBg} borderWidth="1px" borderColor={lineColor} borderRadius="18px">
              <Text fontSize="xs" textTransform="uppercase" color={textMuted} fontWeight="700">
                Contact
              </Text>
              <Text mt={1} fontSize="sm" fontWeight="700" color={textPrimary}>
                {group.sellerEmail || 'No email'}
              </Text>
              <Text fontSize="sm" color={textMuted}>
                {group.sellerPhone || 'No phone'}
              </Text>
            </Box>
            <Box p={3.5} bg={softBg} borderWidth="1px" borderColor={lineColor} borderRadius="18px">
              <Text fontSize="xs" textTransform="uppercase" color={textMuted} fontWeight="700">
                Pickup slot
              </Text>
              <Text mt={1} fontSize="sm" fontWeight="700" color={textPrimary}>
                {group.pickupDate ? formatDateLabel(group.pickupDate) : 'Not scheduled'}
              </Text>
              <Text fontSize="sm" color={textMuted}>
                {group.pickupTime || 'Time not available'}
              </Text>
            </Box>
            <Box p={3.5} bg={softBg} borderWidth="1px" borderColor={lineColor} borderRadius="18px">
              <Text fontSize="xs" textTransform="uppercase" color={textMuted} fontWeight="700">
                Shipment value
              </Text>
              <Text mt={1} fontSize="sm" fontWeight="700" color={textPrimary}>
                {formatCurrency(group.totalOrderAmount)}
              </Text>
              <Text fontSize="sm" color={textMuted}>
                COD total {formatCurrency(group.totalCodAmount)}
              </Text>
            </Box>
          </SimpleGrid>

          <Stack spacing={3}>
            {(group.orders || []).map((order) => (
              <Box
                key={order.id || order.order_id || order.order_number}
                borderWidth="1px"
                borderColor={lineColor}
                borderRadius="20px"
                p={4}
              >
                <Flex
                  justify="space-between"
                  align={{ base: 'flex-start', md: 'center' }}
                  gap={3}
                  direction={{ base: 'column', md: 'row' }}
                >
                  <Box>
                    <Text fontWeight="800" color={textPrimary} fontSize="sm">
                      {order.order_number || order.order_id || 'Order'}
                    </Text>
                    <Text fontSize="xs" color={textMuted} mt={0.5}>
                      AWB {order.awb_number || 'Not generated'} • {order.buyer_name || 'Customer'}
                    </Text>
                  </Box>
                  <HStack spacing={2} flexWrap="wrap">
                    <Badge borderRadius="full" colorScheme={order.order_type === 'cod' ? 'orange' : 'blue'}>
                      {(order.order_type || 'prepaid').toUpperCase()}
                    </Badge>
                    <Badge borderRadius="full" colorScheme="gray">
                      {String(order.order_status || 'pending').replace(/_/g, ' ')}
                    </Badge>
                  </HStack>
                </Flex>

                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3} mt={4}>
                  <Box>
                    <Text fontSize="xs" color={textMuted}>
                      Buyer
                    </Text>
                    <Text fontSize="sm" color={textPrimary} fontWeight="600">
                      {order.buyer_phone || 'No phone'}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={textMuted}>
                      Destination
                    </Text>
                    <Text fontSize="sm" color={textPrimary} fontWeight="600">
                      {[order.city, order.state].filter(Boolean).join(', ') || 'Not available'}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={textMuted}>
                      Amount
                    </Text>
                    <Text fontSize="sm" color={textPrimary} fontWeight="600">
                      {formatCurrency(order.order_amount)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={textMuted}>
                      Updated
                    </Text>
                    <Text fontSize="sm" color={textPrimary} fontWeight="600">
                      {formatShortDateTime(order.updated_at || order.created_at || order.order_date)}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Box>
            ))}
          </Stack>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

function SummaryCard({ item, onNavigate, onOpenGroup }) {
  const accent = CARD_ACCENTS[item.key] || CARD_ACCENTS.todayOrders
  const IconShape = CARD_ICONS[item.key] || FiPackage
  const textPrimary = useColorModeValue('#111827', 'white')
  const textMuted = useColorModeValue('#64748B', 'gray.400')
  const cardBg = useColorModeValue('white', '#101D36')

  return (
    <Card
      bg={cardBg}
      borderRadius="24px"
      borderWidth="1px"
      borderColor={accent.border}
      cursor="pointer"
      onClick={() => onNavigate(item.route)}
      transition="all 0.2s ease"
      _hover={{ transform: 'translateY(-2px)', boxShadow: '0 14px 32px rgba(15,23,42,0.08)' }}
    >
      <CardBody p={4.5}>
        <Flex justify="space-between" align="flex-start" gap={3} mb={5}>
          <Box>
            <Badge
              mb={2}
              bg={accent.bg}
              color={accent.icon}
              borderWidth="1px"
              borderColor={accent.border}
              borderRadius="full"
              px={3}
              py={1}
            >
              {item.badgeLabel || 'Today'}
            </Badge>
            <Text fontSize="sm" fontWeight="700" color={textPrimary}>
              {item.title}
            </Text>
            <Text fontSize="xs" color={textMuted} mt={1}>
              {item.description}
            </Text>
          </Box>
          <Flex
            w="44px"
            h="44px"
            borderRadius="16px"
            align="center"
            justify="center"
            bg={accent.bg}
            color={accent.icon}
            borderWidth="1px"
            borderColor={accent.border}
          >
            <Icon as={IconShape} boxSize={5} />
          </Flex>
        </Flex>

        <Text fontSize={{ base: '3xl', md: '4xl' }} lineHeight="1" fontWeight="900" color={textPrimary}>
          {item.count}
        </Text>

        <Divider my={4} />

        <Stack spacing={2.5}>
          {(item.sellerGroups || []).slice(0, 3).map((group) => (
            <Flex key={`${item.key}-${group.userId}`} justify="space-between" align="center" gap={2}>
              <Button
                variant="link"
                color={textPrimary}
                fontWeight="700"
                fontSize="sm"
                h="auto"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenGroup(group, item.title)
                }}
              >
                {group.sellerName}
              </Button>
              <Badge borderRadius="full" colorScheme="gray">
                {group.shipmentCount}
              </Badge>
            </Flex>
          ))}
          {!item.sellerGroups?.length && (
            <Text fontSize="sm" color={textMuted}>
              No shipments in this queue.
            </Text>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}

function ActionCard({ item, onNavigate, onOpenGroup }) {
  const accent = CARD_ACCENTS[item.key] || CARD_ACCENTS.todayOrders
  const textPrimary = useColorModeValue('#111827', 'white')
  const textMuted = useColorModeValue('#64748B', 'gray.400')
  const borderColor = useColorModeValue('#E2E8F0', 'whiteAlpha.200')
  const cardBg = useColorModeValue('white', '#101D36')

  return (
    <Card
      bg={cardBg}
      borderRadius="24px"
      borderWidth="1px"
      borderColor={borderColor}
      cursor="pointer"
      onClick={() => onNavigate(item.route)}
      transition="all 0.2s ease"
      _hover={{ transform: 'translateY(-2px)', boxShadow: '0 14px 32px rgba(15,23,42,0.08)' }}
    >
      <CardBody p={4.5}>
        <HStack justify="space-between" align="flex-start" mb={4}>
          <Box>
            <Text fontSize="sm" fontWeight="800" color={textPrimary}>
              {item.title}
            </Text>
            <Text fontSize="xs" color={textMuted} mt={1}>
              {item.description}
            </Text>
          </Box>
          <Badge bg={accent.bg} color={accent.icon} borderRadius="full" px={3} py={1}>
            {item.count}
          </Badge>
        </HStack>

        <Stack spacing={2.5}>
          {(item.sellerGroups || []).slice(0, 4).map((group) => (
            <Flex key={`${item.key}-${group.userId}`} justify="space-between" align="center" gap={2}>
              <Button
                variant="link"
                color={textPrimary}
                fontWeight="700"
                fontSize="sm"
                h="auto"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenGroup(group, item.title)
                }}
              >
                {group.sellerName}
              </Button>
              <Text fontSize="xs" color={textMuted}>
                {group.shipmentCount} shipment{group.shipmentCount === 1 ? '' : 's'}
              </Text>
            </Flex>
          ))}
          {!item.sellerGroups?.length && (
            <Text fontSize="sm" color={textMuted}>
              No activity yet for this queue.
            </Text>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}

export default function Dashboard() {
  const history = useHistory()
  const { data: statsData, isLoading, error, refetch, isRefetching } = useDashboardStats()
  const [activeGroup, setActiveGroup] = useState(null)
  const [activeGroupTitle, setActiveGroupTitle] = useState('')

  const pageBg = useColorModeValue(
    'linear-gradient(180deg, #F7F7F3 0%, #F9FAFB 42%, #EEF2FF 100%)',
    '#0F172A',
  )
  const textPrimary = useColorModeValue('#111827', 'white')
  const textMuted = useColorModeValue('#64748B', 'gray.400')
  const borderColor = useColorModeValue('#E2E8F0', 'whiteAlpha.200')
  const panelBg = useColorModeValue('rgba(255,255,255,0.92)', '#101D36')
  const softBg = useColorModeValue('#F8FAFC', 'whiteAlpha.100')
  const progressTrackBg = useColorModeValue('#E5E7EB', 'whiteAlpha.200')

  const stats = statsData?.data || {}
  const businessDate = stats.businessDate || {}
  const dashboardHome = stats.dashboardHome || {}

  const topCards = dashboardHome.topCards || []
  const overviewCards = [
    ...topCards,
    {
      key: 'revenue',
      title: 'Total Revenue',
      description: 'Net platform revenue across all orders',
      count: formatCurrency(stats.financial?.totalRevenue),
      badgeLabel: 'All time',
      route: '/admin/billing-invoices',
      sellerGroups: [],
    },
  ]

  const todayActionCards = dashboardHome.todayActionCards || []
  const onboardingQueue = dashboardHome.onboardingQueue || []
  const upcomingPickups = dashboardHome.upcomingPickups || { sellerGroups: [] }

  const headerSubtitle = useMemo(() => {
    if (!businessDate?.today) return 'Live operational queue for admin'
    return `Business date ${businessDate.today}`
  }, [businessDate])

  const handleNavigate = (route) => {
    if (!route) return
    history.push(route)
  }

  const handleOpenGroup = (group, title) => {
    setActiveGroup(group)
    setActiveGroupTitle(title)
  }

  if (isLoading) {
    return (
      <Flex justify="center" align="center" minH="65vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="orange.400" thickness="4px" />
          <Text color={textMuted}>Loading admin dashboard...</Text>
        </VStack>
      </Flex>
    )
  }

  if (error) {
    return (
      <Flex justify="center" align="center" minH="65vh">
        <VStack spacing={3}>
          <Text color="red.500" fontWeight="700" fontSize="lg">
            Failed to load dashboard data
          </Text>
          <Button size="sm" onClick={() => refetch()} leftIcon={<FiRefreshCw />}>
            Retry
          </Button>
        </VStack>
      </Flex>
    )
  }

  return (
    <Box minH="100vh" pb={8} bg={pageBg}>
      <Container maxW="1440px" pt={{ base: '124px', md: '88px' }} px={{ base: 4, md: 6 }}>
        <Card
          bg={panelBg}
          borderRadius="28px"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="0 18px 48px rgba(15,23,42,0.08)"
          overflow="hidden"
          mb={6}
        >
          <CardBody p={{ base: 5, md: 6 }}>
            <Flex
              justify="space-between"
              align={{ base: 'flex-start', lg: 'center' }}
              gap={4}
              direction={{ base: 'column', lg: 'row' }}
            >
              <Box>
                <Badge bg="#FFF7ED" color="#C2410C" borderRadius="full" px={3} py={1} mb={3}>
                  Admin home
                </Badge>
                <Heading size="lg" color={textPrimary} mb={2}>
                  Operations dashboard
                </Heading>
                <Text color={textMuted} maxW="760px">
                  {headerSubtitle}. Keep an eye on today&apos;s movement, sellers still onboarding,
                  upcoming pickups, and the exact sellers behind each queue.
                </Text>
              </Box>
              <HStack spacing={3}>
                <Button
                  leftIcon={isRefetching ? <Spinner size="sm" /> : <FiRefreshCw />}
                  onClick={() => refetch()}
                  isLoading={isRefetching}
                  bg="#111827"
                  color="white"
                  borderRadius="14px"
                  _hover={{ bg: '#1F2937' }}
                >
                  Refresh
                </Button>
                <Button
                  rightIcon={<FiArrowRight />}
                  variant="outline"
                  borderRadius="14px"
                  onClick={() => history.push('/admin/orders')}
                >
                  Order list
                </Button>
              </HStack>
            </Flex>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4} mb={6}>
          {overviewCards.map((item) => (
            <SummaryCard
              key={item.key}
              item={item}
              onNavigate={handleNavigate}
              onOpenGroup={handleOpenGroup}
            />
          ))}
        </SimpleGrid>

        <Grid templateColumns={{ base: '1fr', xl: '1.15fr 1fr' }} gap={6} mb={6}>
          <Card
            bg={panelBg}
            borderRadius="28px"
            borderWidth="1px"
            borderColor={borderColor}
            boxShadow="0 18px 48px rgba(15,23,42,0.08)"
          >
            <CardBody p={{ base: 4.5, md: 5 }}>
              <HStack spacing={3} mb={5}>
                <Flex
                  w="46px"
                  h="46px"
                  borderRadius="18px"
                  align="center"
                  justify="center"
                  bg="#FFF7ED"
                  color="#EA580C"
                >
                  <Icon as={FiUserPlus} boxSize={5} />
                </Flex>
                <Box>
                  <Heading size="sm" color={textPrimary}>
                    New onboarding users
                  </Heading>
                  <Text fontSize="sm" color={textMuted}>
                    Sellers disappear from here as soon as onboarding completes
                  </Text>
                </Box>
              </HStack>

              <Stack spacing={3}>
                {!onboardingQueue.length && (
                  <Box p={4} borderWidth="1px" borderColor={borderColor} borderRadius="20px" bg={softBg}>
                    <Text fontSize="sm" color={textMuted}>
                      No pending onboarding right now.
                    </Text>
                  </Box>
                )}

                {onboardingQueue.map((user) => (
                  <Box key={user.userId} p={4} borderWidth="1px" borderColor={borderColor} borderRadius="22px" bg={softBg}>
                    <Flex
                      justify="space-between"
                      align={{ base: 'flex-start', md: 'center' }}
                      gap={3}
                      direction={{ base: 'column', md: 'row' }}
                      mb={3}
                    >
                      <Box>
                        <Text fontWeight="800" color={textPrimary}>
                          {user.sellerName}
                        </Text>
                        <Text fontSize="xs" color={textMuted} mt={1}>
                          {user.sellerEmail || 'No email'} • {user.sellerPhone || 'No phone'}
                        </Text>
                      </Box>
                      <Badge borderRadius="full" colorScheme="orange">
                        {user.onboardingLabel}
                      </Badge>
                    </Flex>

                    <Progress
                      value={user.progress}
                      size="sm"
                      borderRadius="999px"
                      colorScheme="orange"
                      bg={progressTrackBg}
                      mb={3}
                    />

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      <HStack align="flex-start" spacing={2}>
                        <Icon as={FiCalendar} color="#F97316" mt="2px" />
                        <Box>
                          <Text fontSize="xs" color={textMuted}>
                            Stage
                          </Text>
                          <Text fontSize="sm" color={textPrimary} fontWeight="600">
                            {user.onboardingDescription}
                          </Text>
                        </Box>
                      </HStack>
                      <HStack align="flex-start" spacing={2}>
                        <Icon as={FiMapPin} color="#F97316" mt="2px" />
                        <Box>
                          <Text fontSize="xs" color={textMuted}>
                            Location
                          </Text>
                          <Text fontSize="sm" color={textPrimary} fontWeight="600">
                            {[user.city, user.state].filter(Boolean).join(', ') || 'Not added yet'}
                          </Text>
                        </Box>
                      </HStack>
                      <HStack align="flex-start" spacing={2}>
                        <Icon as={FiClock} color="#F97316" mt="2px" />
                        <Box>
                          <Text fontSize="xs" color={textMuted}>
                            Last activity
                          </Text>
                          <Text fontSize="sm" color={textPrimary} fontWeight="600">
                            {formatShortDateTime(user.updatedAt || user.submittedAt || user.createdAt)}
                          </Text>
                        </Box>
                      </HStack>
                    </SimpleGrid>
                  </Box>
                ))}
              </Stack>
            </CardBody>
          </Card>

          <Card
            bg={panelBg}
            borderRadius="28px"
            borderWidth="1px"
            borderColor={borderColor}
            boxShadow="0 18px 48px rgba(15,23,42,0.08)"
          >
            <CardBody p={{ base: 4.5, md: 5 }}>
              <Flex justify="space-between" align="center" mb={5} gap={3}>
                <HStack spacing={3}>
                  <Flex
                    w="46px"
                    h="46px"
                    borderRadius="18px"
                    align="center"
                    justify="center"
                    bg="#EFF6FF"
                    color="#2563EB"
                  >
                    <Icon as={FiTruck} boxSize={5} />
                  </Flex>
                  <Box>
                    <Heading size="sm" color={textPrimary}>
                      Upcoming pickups
                    </Heading>
                    <Text fontSize="sm" color={textMuted}>
                      {upcomingPickups.count || 0} scheduled shipment
                      {upcomingPickups.count === 1 ? '' : 's'}
                    </Text>
                  </Box>
                </HStack>
                <Button
                  variant="link"
                  rightIcon={<FiArrowRight />}
                  color="#2563EB"
                  onClick={() => handleNavigate(upcomingPickups.route)}
                >
                  View more
                </Button>
              </Flex>

              <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3.5}>
                {!upcomingPickups.sellerGroups?.length && (
                  <Box
                    gridColumn={{ base: 'span 1', md: 'span 2' }}
                    p={4}
                    borderWidth="1px"
                    borderColor={borderColor}
                    borderRadius="22px"
                    bg={softBg}
                  >
                    <Text fontSize="sm" color={textMuted}>
                      No upcoming pickups scheduled right now.
                    </Text>
                  </Box>
                )}

                {(upcomingPickups.sellerGroups || []).slice(0, 4).map((group) => (
                  <Box key={group.userId} p={4} borderWidth="1px" borderColor={borderColor} borderRadius="22px" bg={softBg}>
                    <Flex justify="space-between" align="flex-start" gap={3} mb={4}>
                      <Box>
                        <Button
                          variant="link"
                          color={textPrimary}
                          fontWeight="800"
                          fontSize="md"
                          h="auto"
                          onClick={() => handleOpenGroup(group, 'Upcoming pickups')}
                        >
                          {group.sellerName}
                        </Button>
                        <Text fontSize="xs" color={textMuted} mt={1}>
                          {group.sellerEmail || group.sellerPhone || 'No contact available'}
                        </Text>
                      </Box>
                      <Badge borderRadius="full" colorScheme="orange">
                        Scheduled
                      </Badge>
                    </Flex>

                    <HStack spacing={4} mb={3} flexWrap="wrap">
                      <HStack spacing={2}>
                        <Icon as={FiCalendar} color="#F59E0B" />
                        <Text fontSize="sm" color={textPrimary} fontWeight="600">
                          {group.pickupDate ? formatDateLabel(group.pickupDate) : 'Date pending'}
                        </Text>
                      </HStack>
                      <HStack spacing={2}>
                        <Icon as={FiPackage} color="#2563EB" />
                        <Text fontSize="sm" color={textPrimary} fontWeight="600">
                          {group.shipmentCount} AWB{group.shipmentCount === 1 ? '' : 's'}
                        </Text>
                      </HStack>
                    </HStack>

                    <Text fontSize="xs" color={textMuted}>
                      Pickup window {group.pickupTime || 'will update once courier confirms the slot'}
                    </Text>
                  </Box>
                ))}
              </Grid>
            </CardBody>
          </Card>
        </Grid>

        <Card
          bg={panelBg}
          borderRadius="28px"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="0 18px 48px rgba(15,23,42,0.08)"
        >
          <CardBody p={{ base: 4.5, md: 5 }}>
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3} mb={5}>
              <Box>
                <Heading size="sm" color={textPrimary}>
                  Today&apos;s shipment queues
                </Heading>
                <Text fontSize="sm" color={textMuted}>
                  Each card opens the exact filtered screen, and seller names open shipment detail popups.
                </Text>
              </Box>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
              {todayActionCards.map((item) => (
                <ActionCard
                  key={item.key}
                  item={item}
                  onNavigate={handleNavigate}
                  onOpenGroup={handleOpenGroup}
                />
              ))}
            </SimpleGrid>
          </CardBody>
        </Card>

        <ShipmentDetailsModal
          group={activeGroup}
          title={activeGroupTitle}
          isOpen={Boolean(activeGroup)}
          onClose={() => {
            setActiveGroup(null)
            setActiveGroupTitle('')
          }}
        />
      </Container>
    </Box>
  )
}
