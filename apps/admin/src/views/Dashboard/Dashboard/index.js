import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  IconAlertTriangle,
  IconChartBar,
  IconCheck,
  IconCircleCheck,
  IconCoinRupee,
  IconMapPin,
  IconPackageExport,
  IconRefresh,
  IconShieldCheck,
} from '@tabler/icons-react'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import CardHeader from 'components/Card/CardHeader'
import OrdersLineChart from 'components/Charts/OrdersLineChart'
import RevenueBarChart from 'components/Charts/RevenueBarChart'
import { useDashboardStats } from 'hooks/useDashboardStats'
import { useHistory } from 'react-router-dom'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)

const toNum = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function MetricCard({ title, value, subtitle, icon, color = 'brand.500' }) {
  const textPrimary = useColorModeValue('#111827', 'gray.100')
  const textSecondary = useColorModeValue('#64748B', 'gray.400')
  const iconBg = useColorModeValue('rgba(37,99,235,0.08)', 'rgba(148,163,184,0.14)')

  return (
    <Card borderRadius="16px" h="full" bg={useColorModeValue('#FFFFFF', 'rgba(18,27,45,0.9)')} borderWidth="1px" borderColor={useColorModeValue('#E5E7EB', 'rgba(255,255,255,0.08)')} boxShadow="0 12px 28px rgba(15,23,42,0.06)">
      <CardBody p={4}>
        <HStack justify="space-between" align="flex-start" mb={2}>
          <Text fontSize="sm" color={textPrimary} fontWeight="700">
            {title}
          </Text>
          <Flex w="36px" h="36px" borderRadius="10px" bg={iconBg} align="center" justify="center" color={color}>
            {icon}
          </Flex>
        </HStack>
        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color={textPrimary} lineHeight="1.1">
          {value}
        </Text>
        <Text mt={1.5} fontSize="xs" color={textSecondary}>
          {subtitle}
        </Text>
      </CardBody>
    </Card>
  )
}

export default function Dashboard() {
  const history = useHistory()
  const { data: statsData, isLoading, error, refetch, isRefetching } = useDashboardStats()

  const pageBg = useColorModeValue('#F5F7FB', '#142238')
  const panelBg = useColorModeValue('#FFFFFF', '#101D36')
  const borderColor = useColorModeValue('#E5E7EB', 'rgba(148,163,184,0.2)')
  const textPrimary = useColorModeValue('#111827', 'gray.100')
  const textSecondary = useColorModeValue('#64748B', 'gray.400')
  const tileBg = useColorModeValue('#F8FAFC', 'rgba(148,163,184,0.1)')

  const stats = statsData?.data || {}
  const todayOps = stats.todayOperations || {}
  const financial = stats.financial || {}
  const operational = stats.operational || {}
  const alerts = stats.alerts || {}
  const couriers = stats.couriers || {}
  const geographic = stats.geographic || {}
  const charts = stats.charts || {}

  const heroHighlights = [
    {
      title: 'Today orders',
      value: toNum(todayOps.orders).toLocaleString(),
    },
    {
      title: 'Delivery success',
      value: `${toNum(operational.deliverySuccessRate)}%`,
    },
    {
      title: 'Net revenue',
      value: formatCurrency(financial.totalRevenue),
    },
  ]

  const focusItems = [
    {
      title: 'Dispatch readiness',
      value: Math.max(0, 100 - toNum(todayOps.pending)),
      note: `${toNum(todayOps.pending)} pending`,
      color: 'blue',
    },
    {
      title: 'Delivery quality',
      value: toNum(operational.deliverySuccessRate),
      note: `${toNum(operational.deliveredOrders)} delivered`,
      color: 'green',
    },
    {
      title: 'Support pressure',
      value: Math.max(0, 100 - toNum(alerts.openTickets)),
      note: `${toNum(alerts.openTickets)} open tickets`,
      color: 'orange',
    },
  ]

  const topCouriers = Object.entries(couriers.performance || {})
    .map(([name, value]) => ({
      name,
      count: toNum(value?.count),
      deliveryRate: toNum(value?.deliveryRate),
      revenue: toNum(value?.revenue),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  if (isLoading) {
    return (
      <Flex justify="center" align="center" minH="65vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.500" thickness="4px" />
          <Text color={textSecondary}>Loading dashboard...</Text>
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
          <Button size="sm" onClick={() => refetch()} leftIcon={<IconRefresh size={16} />}>
            Retry
          </Button>
        </VStack>
      </Flex>
    )
  }

  return (
    <Box minH="100vh" pb={8} bg={pageBg}>
      <Container maxW="full" pt={{ base: '128px', md: '88px' }} px={{ base: 4, md: 6 }}>
        <Grid templateColumns={{ base: '1fr', xl: '1.25fr 0.75fr' }} gap={{ base: 4, xl: 5 }} mb={5} alignItems="stretch">
          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="18px" boxShadow="0 14px 34px rgba(15,23,42,0.07)">
            <CardBody p={{ base: 4, md: 5 }}>
              <Stack spacing={4}>
                <HStack justify="space-between" flexWrap="wrap" spacing={3}>
                  <VStack align="flex-start" spacing={1}>
                    <Text fontSize="xs" fontWeight="800" letterSpacing="0.12em" textTransform="uppercase" color="blue.500">
                      Admin dashboard
                    </Text>
                    <Heading size="lg" color={textPrimary}>
                      Operations overview
                    </Heading>
                    <Text color={textSecondary} maxW="620px" lineHeight="1.7">
                      Monitor shipment volume, revenue, courier health, and priority queues from one clean workspace.
                    </Text>
                  </VStack>
                  <HStack spacing={3}>
                    <Button
                      size="sm"
                      leftIcon={isRefetching ? <Spinner size="sm" /> : <IconRefresh size={16} />}
                      isLoading={isRefetching}
                      onClick={() => refetch()}
                      borderRadius="10px"
                      bg="blue.600"
                      color="white"
                      _hover={{ bg: 'blue.700' }}
                    >
                      Refresh
                    </Button>
                    <Button size="sm" variant="outline" borderColor={borderColor} borderRadius="10px" onClick={() => history.push('/admin/orders')}>
                      Orders
                    </Button>
                  </HStack>
                </HStack>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={2.5}>
                  {heroHighlights.map((item) => (
                    <Box key={item.title} p={4} borderRadius="14px" bg={tileBg} borderWidth="1px" borderColor={borderColor}>
                      <Text fontSize="xs" fontWeight="700" color={textSecondary}>
                        {item.title}
                      </Text>
                      <Text mt={1.5} fontSize="lg" fontWeight="800" color={textPrimary}>
                        {item.value}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Stack>
            </CardBody>
          </Card>

          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="18px" boxShadow="0 14px 34px rgba(15,23,42,0.07)">
            <CardBody p={{ base: 4, md: 5 }}>
              <HStack spacing={3} mb={4}>
                <Flex w="38px" h="38px" align="center" justify="center" borderRadius="10px" bg="blue.50" color="blue.600">
                  <IconChartBar size={18} />
                </Flex>
                <Box>
                  <Heading size="sm" color={textPrimary}>Operational Focus</Heading>
                  <Text fontSize="sm" color={textSecondary}>Live health snapshot</Text>
                </Box>
              </HStack>
              <VStack align="stretch" spacing={4}>
                {focusItems.map((item) => (
                  <Box key={item.title}>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="700" color={textPrimary}>{item.title}</Text>
                      <Text fontSize="xs" color={textSecondary}>{item.note}</Text>
                    </HStack>
                    <Progress value={Math.min(100, item.value)} size="sm" borderRadius="999px" colorScheme={item.color} bg="gray.100" />
                  </Box>
                ))}
              </VStack>
            </CardBody>
          </Card>
        </Grid>

        <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4} mb={6}>
          <MetricCard
            title="Today Orders"
            value={toNum(todayOps.orders).toLocaleString()}
            subtitle={`${toNum(todayOps.pending)} of today's orders pending dispatch`}
            icon={<IconPackageExport size={18} />}
            color="blue.600"
          />
          <MetricCard
            title="Delivery Success"
            value={`${toNum(operational.deliverySuccessRate)}%`}
            subtitle={`${toNum(operational.deliveredOrders)} delivered out of ${toNum(operational.totalOrders)} orders`}
            icon={<IconCircleCheck size={18} />}
            color="green.500"
          />
          <MetricCard
            title="NDR Rate"
            value={`${toNum(operational.ndrRate)}%`}
            subtitle={`${toNum(operational.ndrOrders)} active NDR orders`}
            icon={<IconShieldCheck size={18} />}
            color="orange.500"
          />
          <MetricCard
            title="Net Revenue"
            value={formatCurrency(financial.totalRevenue)}
            subtitle={`Today ${formatCurrency(financial.todayRevenue)} | Freight - courier cost`}
            icon={<IconCoinRupee size={18} />}
            color="blue.600"
          />
        </SimpleGrid>

        <Grid templateColumns={{ base: '1fr', xl: '1.45fr 1fr' }} gap={6} mb={6}>
          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="18px" h="full" boxShadow="0 14px 34px rgba(15,23,42,0.06)">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Orders Trend (7 days)</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>Shipment volume by day</Text>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <Box h={{ base: '240px', md: '320px' }}>
                <OrdersLineChart data={charts.ordersByDate || []} />
              </Box>
            </CardBody>
          </Card>

          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="18px" h="full" boxShadow="0 14px 34px rgba(15,23,42,0.06)">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Action Queue</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>Operational items needing attention</Text>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <VStack spacing={3} align="stretch">
                {[
                  {
                    title: 'Open Tickets',
                    value: toNum(alerts.openTickets),
                    note: toNum(alerts.overdueTickets) ? `${toNum(alerts.overdueTickets)} overdue` : 'Support triage',
                    route: '/admin/support',
                    colorScheme: 'red',
                  },
                  {
                    title: 'Pending KYC',
                    value: toNum(alerts.pendingKyc),
                    note: 'Verification queue',
                    route: '/admin/users-management',
                    colorScheme: 'orange',
                  },
                  {
                    title: 'Weight Disputes',
                    value: toNum(alerts.weightDiscrepancies),
                    note: 'Review reconciliation',
                    route: '/admin/weight-reconciliation',
                    colorScheme: 'blue',
                  },
                ].map((item) => (
                  <Flex
                    key={item.title}
                    p={3.5}
                    borderRadius="12px"
                    borderWidth="1px"
                    borderColor={`${item.colorScheme}.200`}
                    bg={`${item.colorScheme}.50`}
                    justify="space-between"
                    align="center"
                    cursor="pointer"
                    onClick={() => history.push(item.route)}
                    _hover={{ transform: 'translateY(-1px)' }}
                    transition="all 0.2s"
                  >
                    <Box>
                      <Text fontSize="sm" fontWeight="700" color={textPrimary}>{item.title}</Text>
                      <Text fontSize="xs" color={textSecondary}>{item.note}</Text>
                    </Box>
                    <Badge colorScheme={item.colorScheme} borderRadius="full">{item.value}</Badge>
                  </Flex>
                ))}
              </VStack>
            </CardBody>
          </Card>
        </Grid>

        <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6} mb={6}>
          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="18px" h="full" boxShadow="0 14px 34px rgba(15,23,42,0.06)">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Revenue Trend (7 days)</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>Net revenue performance</Text>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <Box h={{ base: '240px', md: '300px' }}>
                <RevenueBarChart data={charts.revenueByDate || []} />
              </Box>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mt={4}>
                <Box p={3.5} borderRadius="12px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.45px" color={textSecondary} fontWeight="700">
                    COD Outstanding
                  </Text>
                  <Text mt={1} fontWeight="800" color={textPrimary}>{formatCurrency(financial.codRemittanceDue)}</Text>
                </Box>
                <Box p={3.5} borderRadius="12px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.45px" color={textSecondary} fontWeight="700">
                    Total COD Value
                  </Text>
                  <Text mt={1} fontWeight="800" color={textPrimary}>{formatCurrency(financial.codAmount)}</Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>

          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="18px" h="full" boxShadow="0 14px 34px rgba(15,23,42,0.06)">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Courier Snapshot</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>Top couriers by volume</Text>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <VStack spacing={3} align="stretch">
                {topCouriers.length === 0 ? (
                  <Text fontSize="sm" color={textSecondary}>No courier data available.</Text>
                ) : (
                  topCouriers.map((courier, index) => (
                    <Box key={courier.name} p={3.5} borderRadius="12px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                      <HStack justify="space-between" mb={2}>
                        <HStack spacing={2}>
                          <Badge borderRadius="full">{index + 1}</Badge>
                          <Text fontSize="sm" fontWeight="700" color={textPrimary}>{courier.name}</Text>
                        </HStack>
                        <Text fontSize="sm" color={textSecondary}>{courier.count} orders</Text>
                      </HStack>
                      <HStack justify="space-between" mb={2}>
                        <Text fontSize="xs" color={textSecondary}>Delivery Rate</Text>
                        <Text fontSize="xs" color={textSecondary}>{courier.deliveryRate}%</Text>
                      </HStack>
                      <Progress size="sm" borderRadius="full" value={courier.deliveryRate} colorScheme="green" mb={2} />
                      <Text fontSize="xs" color={textSecondary}>Revenue: {formatCurrency(courier.revenue)}</Text>
                    </Box>
                  ))
                )}
              </VStack>
            </CardBody>
          </Card>
        </Grid>

        <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6}>
          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="18px" h="full" boxShadow="0 14px 34px rgba(15,23,42,0.06)">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Origin Hotspots</Heading>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <Stack spacing={2.5}>
                {(geographic.topOriginCities || []).length === 0 ? (
                  <Text fontSize="sm" color={textSecondary}>No origin city data yet.</Text>
                ) : (
                  (geographic.topOriginCities || []).slice(0, 5).map((item) => (
                    <HStack key={`origin-${item.city}`} justify="space-between" p={3} borderRadius="12px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                      <HStack spacing={2}>
                        <IconMapPin size={16} color="#0C3B80" />
                        <Text color={textPrimary} fontSize="sm">{item.city}</Text>
                      </HStack>
                      <Badge>{toNum(item.count)}</Badge>
                    </HStack>
                  ))
                )}
              </Stack>
            </CardBody>
          </Card>

          <Card bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="18px" h="full" boxShadow="0 14px 34px rgba(15,23,42,0.06)">
            <CardHeader p={5} pb={2}>
              <Heading size="sm" color={textPrimary}>Destination Hotspots</Heading>
            </CardHeader>
            <CardBody p={5} pt={2}>
              <Stack spacing={2.5}>
                {(geographic.topDestinationCities || []).length === 0 ? (
                  <Text fontSize="sm" color={textSecondary}>No destination city data yet.</Text>
                ) : (
                  (geographic.topDestinationCities || []).slice(0, 5).map((item) => (
                    <HStack key={`dest-${item.city}`} justify="space-between" p={3} borderRadius="12px" borderWidth="1px" borderColor={borderColor} bg={tileBg}>
                      <HStack spacing={2}>
                        <IconMapPin size={16} color="#F57C00" />
                        <Text color={textPrimary} fontSize="sm">{item.city}</Text>
                      </HStack>
                      <Badge>{toNum(item.count)}</Badge>
                    </HStack>
                  ))
                )}
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Container>
    </Box>
  )
}
