import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react'
import {
  useBookAdminManualB2CCourierMutation,
  useCreateAdminManualB2COrderMutation,
  useFetchAdminManualB2CCouriersMutation,
  useManualBookingUsers,
  useManualBookingWarehouses,
  useOrders,
} from 'hooks/useOrders'
import { useEffect, useMemo, useState } from 'react'
import { FiPackage, FiRefreshCw, FiSearch, FiTruck, FiUser } from 'react-icons/fi'

const STORAGE_KEY = 'choicemee.admin.manualBooking.selectedUserId'

const todayInput = () => new Date().toISOString().slice(0, 10)

const defaultForm = () => ({
  orderId: `ORD-${Date.now()}`,
  orderDate: todayInput(),
  orderType: 'prepaid',
  buyerName: '',
  buyerPhone: '',
  buyerEmail: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  productName: '',
  sku: 'NA',
  hsn: '',
  quantity: 1,
  price: '',
  productDiscount: 0,
  taxRate: 0,
  weight: '',
  length: '',
  breadth: '',
  height: '',
  shippingCharges: 0,
  transactionFee: 0,
  giftWrap: 0,
  discount: 0,
  prepaidAmount: 0,
  pickupDate: todayInput(),
  pickupTime: '',
})

const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const formatCurrency = (value) => `₹${toNumber(value).toFixed(2)}`

const getCourierId = (courier) => Number(courier?.id ?? courier?.courier_id ?? 0)

const getCourierName = (courier) =>
  courier?.displayName ||
  courier?.display_name ||
  courier?.name ||
  courier?.courier_name ||
  courier?.serviceProvider ||
  'Courier'

const getForwardCharge = (courier) =>
  toNumber(
    courier?.final_freight_charge ??
      courier?.seller_freight_charge ??
      courier?.platform_rate ??
      courier?.rateEstimate ??
      courier?.rate,
  )

const getCourierCost = (courier) =>
  toNumber(courier?.courier_cost_estimate ?? courier?.provider_quote ?? courier?.provider_rate?.total)

const getCodCharge = (courier) =>
  toNumber(
    courier?.cod_charges ??
      courier?.codCharges ??
      courier?.provider_rate?.cod ??
      courier?.localRates?.forward?.cod_charges,
  )

const getOtherCharge = (courier) => toNumber(courier?.other_charges ?? courier?.localRates?.forward?.other_charges)

const getFinalCharge = (courier) =>
  toNumber(courier?.final_courier_charge ?? getForwardCharge(courier) + getOtherCharge(courier) + getCodCharge(courier))

const ManualBooking = () => {
  const toast = useToast()
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const panelBg = useColorModeValue('white', 'gray.700')
  const subtleBg = useColorModeValue('gray.50', 'gray.800')
  const textColor = useColorModeValue('gray.700', 'white')

  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [form, setForm] = useState(defaultForm)
  const [createdOrder, setCreatedOrder] = useState(null)
  const [couriers, setCouriers] = useState([])
  const [selectedCourierKey, setSelectedCourierKey] = useState('')
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersLimit, setOrdersLimit] = useState(10)

  const { data: usersData, isLoading: usersLoading } = useManualBookingUsers(userSearch)
  const { data: warehousesData, isLoading: warehousesLoading } =
    useManualBookingWarehouses(selectedUserId)
  const { data: ordersData, isFetching: ordersFetching, refetch: refetchOrders } = useOrders(
    ordersPage,
    ordersLimit,
    {
      type: 'b2c',
      tag: 'admin_manual_booking',
      sortBy: 'created_at',
      sortOrder: 'desc',
    },
  )
  const createDraft = useCreateAdminManualB2COrderMutation()
  const fetchCouriers = useFetchAdminManualB2CCouriersMutation()
  const bookCourier = useBookAdminManualB2CCourierMutation()

  const users = usersData?.users || []
  const warehouses = warehousesData?.warehouses || []
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.pickupId === selectedWarehouseId)
  const selectedCourier = couriers.find(
    (courier) =>
      String(courier?.courier_option_key ?? getCourierId(courier)) === String(selectedCourierKey),
  )

  const subtotal = useMemo(
    () => Math.max(0, toNumber(form.price) * Math.max(1, toNumber(form.quantity)) - toNumber(form.productDiscount)),
    [form.price, form.quantity, form.productDiscount],
  )
  const declaredValue = useMemo(
    () =>
      Math.max(
        0,
        subtotal +
          toNumber(form.shippingCharges) +
          toNumber(form.transactionFee) +
          toNumber(form.giftWrap) -
          toNumber(form.discount),
      ),
    [form.discount, form.giftWrap, form.shippingCharges, form.transactionFee, subtotal],
  )
  const collectableValue = Math.max(0, declaredValue - toNumber(form.prepaidAmount))

  useEffect(() => {
    if (selectedUserId) localStorage.setItem(STORAGE_KEY, selectedUserId)
  }, [selectedUserId])

  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length) {
      const primary = warehouses.find((warehouse) => warehouse.isPrimary) || warehouses[0]
      setSelectedWarehouseId(primary.pickupId)
    }
  }, [selectedWarehouseId, warehouses])

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const buildOrderPayload = () => {
    const pickup = selectedWarehouse?.pickup || {}
    return {
      userId: selectedUserId,
      order_number: String(form.orderId).trim(),
      payment_type: form.orderType,
      order_amount: subtotal,
      cod_charge_basis: collectableValue,
      order_date: form.orderDate,
      package_weight: toNumber(form.weight) > 50 ? toNumber(form.weight) : toNumber(form.weight) * 1000,
      package_length: toNumber(form.length),
      package_breadth: toNumber(form.breadth),
      package_height: toNumber(form.height),
      shipping_charges: toNumber(form.shippingCharges),
      transaction_fee: toNumber(form.transactionFee),
      gift_wrap: toNumber(form.giftWrap),
      discount: toNumber(form.discount),
      prepaid_amount: toNumber(form.prepaidAmount),
      is_rto_different: 'no',
      consignee: {
        name: form.buyerName,
        phone: form.buyerPhone,
        email: form.buyerEmail,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      },
      pickup_location_id: selectedWarehouseId,
      pickup: {
        warehouse_name: pickup.warehouse_name || pickup.name || '',
        name: pickup.name || pickup.warehouse_name || '',
        phone: pickup.phone || '',
        address: pickup.address || '',
        address_2: pickup.address_2 || '',
        city: pickup.city || '',
        state: pickup.state || '',
        pincode: pickup.pincode || '',
        gst_number: pickup.gst_number || '',
        pickup_date: form.pickupDate,
        pickup_time: form.pickupTime,
      },
      order_items: [
        {
          name: form.productName,
          sku: form.sku || 'NA',
          qty: Math.max(1, toNumber(form.quantity)),
          price: toNumber(form.price),
          hsn: form.hsn || '',
          discount: toNumber(form.productDiscount),
          tax_rate: toNumber(form.taxRate),
        },
      ],
      pickup_date: form.pickupDate,
      pickup_time: form.pickupTime,
      tags: 'admin_manual_booking',
    }
  }

  const validateBeforeDraft = () => {
    if (!selectedUserId) return 'Please select a fully registered user.'
    if (!selectedWarehouseId) return 'Please select a pickup warehouse.'
    if (!String(form.orderId).trim()) return 'Order ID is required.'
    if (!form.buyerName || !form.buyerPhone || !form.address || !form.city || !form.state || !form.pincode) {
      return 'Customer name, phone, address, city, state, and pincode are required.'
    }
    if (!form.productName || subtotal <= 0) return 'Product name and product value are required.'
    if (!toNumber(form.weight) || !toNumber(form.length) || !toNumber(form.breadth) || !toNumber(form.height)) {
      return 'Package weight and dimensions are required.'
    }
    return ''
  }

  const handleCreateDraft = async () => {
    const validationError = validateBeforeDraft()
    if (validationError) {
      toast({ title: 'Missing details', description: validationError, status: 'warning', isClosable: true })
      return
    }

    try {
      const response = await createDraft.mutateAsync(buildOrderPayload())
      const order = response?.data?.order || response?.order
      setCreatedOrder(order)
      setCouriers([])
      setSelectedCourierKey('')
      refetchOrders()
      toast({
        title: 'Draft created',
        description: 'The order is saved under the selected seller and is ready for courier selection.',
        status: 'success',
        isClosable: true,
      })
    } catch (error) {
      toast({
        title: 'Draft creation failed',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
      })
    }
  }

  const handleFetchCouriers = async () => {
    const validationError = validateBeforeDraft()
    if (validationError) {
      toast({ title: 'Missing details', description: validationError, status: 'warning', isClosable: true })
      return
    }

    try {
      const pickup = selectedWarehouse?.pickup || {}
      const response = await fetchCouriers.mutateAsync({
        userId: selectedUserId,
        origin: pickup.pincode,
        destination: form.pincode,
        pickupId: selectedWarehouseId,
        payment_type: form.orderType,
        order_amount: declaredValue,
        cod_charge_basis: collectableValue,
        weight: toNumber(form.weight) > 50 ? toNumber(form.weight) : toNumber(form.weight) * 1000,
        length: toNumber(form.length),
        breadth: toNumber(form.breadth),
        height: toNumber(form.height),
      })
      setCouriers(response?.data || [])
      setSelectedCourierKey('')
    } catch (error) {
      toast({
        title: 'Courier check failed',
        description: error?.response?.data?.error || error.message,
        status: 'error',
        isClosable: true,
      })
    }
  }

  const handleBookCourier = async (order = createdOrder) => {
    if (!order?.id) {
      toast({ title: 'Create or select a draft first', status: 'warning', isClosable: true })
      return
    }
    if (!selectedCourier) {
      toast({ title: 'Select a courier first', status: 'warning', isClosable: true })
      return
    }

    try {
      await bookCourier.mutateAsync({
        orderId: order.id,
        payload: {
          courier_id: getCourierId(selectedCourier),
          courier_option_key: selectedCourier?.courier_option_key,
          selected_max_slab_weight: selectedCourier?.max_slab_weight,
          integration_type: selectedCourier?.integration_type,
          shipping_mode: selectedCourier?.shipping_mode ?? selectedCourier?.mode ?? '',
          freight_charges: getForwardCharge(selectedCourier),
          courier_cost: getCourierCost(selectedCourier) || undefined,
          other_charges: getOtherCharge(selectedCourier),
          cod_charges: getCodCharge(selectedCourier),
          delivery_location: selectedCourier?.approxZone?.code ?? selectedCourier?.approxZone?.name ?? '',
          zone_id: selectedCourier?.approxZone?.id ?? '',
          pickup_date: form.pickupDate,
          pickup_time: form.pickupTime,
        },
      })
      toast({ title: 'Courier booked', status: 'success', isClosable: true })
      refetchOrders()
    } catch (error) {
      toast({
        title: 'Courier booking failed',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        isClosable: true,
      })
    }
  }

  return (
    <Box pt={{ base: '120px', md: '75px' }}>
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
          <Flex align="center" justify="center" w={12} h={12} borderRadius="lg" bg="blue.500">
            <Icon as={FiTruck} w={6} h={6} color="white" />
          </Flex>
          <Box>
            <Heading size="lg" color={textColor}>
              Manual B2C Booking
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Create seller-owned B2C drafts and book couriers from the admin panel
            </Text>
          </Box>
        </HStack>
      </Flex>

      <Stack spacing={5}>
        <Box bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={5}>
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
            <FormControl>
              <FormLabel>Select User</FormLabel>
              <HStack>
                <Input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search seller email, phone, or company"
                />
                <Button leftIcon={<FiSearch />} onClick={() => {}} variant="outline">
                  Search
                </Button>
              </HStack>
              <Select
                mt={2}
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.target.value)
                  setOrdersPage(1)
                  setSelectedWarehouseId('')
                  setCreatedOrder(null)
                  setCouriers([])
                }}
                placeholder={usersLoading ? 'Loading users...' : 'Select fully registered user'}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.companyName || user.email || user.phone} {user.email ? `(${user.email})` : ''}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Select Warehouse</FormLabel>
              <Select
                value={selectedWarehouseId}
                onChange={(event) => setSelectedWarehouseId(event.target.value)}
                placeholder={warehousesLoading ? 'Loading warehouses...' : 'Select warehouse'}
                isDisabled={!selectedUserId}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.pickupId} value={warehouse.pickupId}>
                    {warehouse.pickup?.warehouse_name} - {warehouse.pickup?.pincode}
                  </option>
                ))}
              </Select>
              {selectedWarehouse && (
                <Text mt={2} fontSize="xs" color="gray.500">
                  {selectedWarehouse.pickup?.address}, {selectedWarehouse.pickup?.city},{' '}
                  {selectedWarehouse.pickup?.state}
                </Text>
              )}
            </FormControl>
          </SimpleGrid>
        </Box>

        <Box bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={5}>
          <Heading size="md" mb={4}>
            B2C Order Form
          </Heading>
          <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={5}>
            <GridItem>
              <Stack spacing={5}>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Order ID</FormLabel>
                    <Input value={form.orderId} onChange={(e) => updateForm('orderId', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Order Date</FormLabel>
                    <Input type="date" value={form.orderDate} onChange={(e) => updateForm('orderDate', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Payment Mode</FormLabel>
                    <Select value={form.orderType} onChange={(e) => updateForm('orderType', e.target.value)}>
                      <option value="prepaid">Prepaid</option>
                      <option value="cod">COD</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <Divider />
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  {[
                    ['buyerName', 'Buyer Name'],
                    ['buyerPhone', 'Buyer Phone'],
                    ['buyerEmail', 'Buyer Email'],
                    ['address', 'Address'],
                    ['city', 'City'],
                    ['state', 'State'],
                    ['pincode', 'Pincode'],
                  ].map(([key, label]) => (
                    <FormControl key={key}>
                      <FormLabel>{label}</FormLabel>
                      <Input value={form[key]} onChange={(e) => updateForm(key, e.target.value)} />
                    </FormControl>
                  ))}
                </SimpleGrid>

                <Divider />
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                  {[
                    ['productName', 'Product Name'],
                    ['sku', 'SKU'],
                    ['quantity', 'Qty', 'number'],
                    ['price', 'Unit Price', 'number'],
                    ['productDiscount', 'Product Discount', 'number'],
                    ['hsn', 'HSN'],
                    ['taxRate', 'Tax %', 'number'],
                  ].map(([key, label, type]) => (
                    <FormControl key={key}>
                      <FormLabel>{label}</FormLabel>
                      <Input type={type || 'text'} value={form[key]} onChange={(e) => updateForm(key, e.target.value)} />
                    </FormControl>
                  ))}
                </SimpleGrid>

                <Divider />
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                  {[
                    ['weight', 'Weight (kg)', 'number'],
                    ['length', 'Length (cm)', 'number'],
                    ['breadth', 'Breadth (cm)', 'number'],
                    ['height', 'Height (cm)', 'number'],
                    ['shippingCharges', 'Shipping Charges', 'number'],
                    ['transactionFee', 'Transaction Fee', 'number'],
                    ['giftWrap', 'Gift Wrap', 'number'],
                    ['discount', 'Order Discount', 'number'],
                    ['prepaidAmount', 'Prepaid Amount', 'number'],
                    ['pickupDate', 'Pickup Date', 'date'],
                    ['pickupTime', 'Pickup Time', 'time'],
                  ].map(([key, label, type]) => (
                    <FormControl key={key}>
                      <FormLabel>{label}</FormLabel>
                      <Input type={type} value={form[key]} onChange={(e) => updateForm(key, e.target.value)} />
                    </FormControl>
                  ))}
                </SimpleGrid>

                <HStack spacing={3} flexWrap="wrap">
                  <Button
                    leftIcon={<FiPackage />}
                    colorScheme="blue"
                    onClick={handleCreateDraft}
                    isLoading={createDraft.isPending}
                  >
                    Create Draft
                  </Button>
                  <Button
                    leftIcon={<FiRefreshCw />}
                    variant="outline"
                    onClick={handleFetchCouriers}
                    isLoading={fetchCouriers.isPending}
                  >
                    Check Couriers
                  </Button>
                  <Button
                    leftIcon={<FiTruck />}
                    colorScheme="green"
                    onClick={() => handleBookCourier()}
                    isDisabled={!createdOrder?.id || !selectedCourier}
                    isLoading={bookCourier.isPending}
                  >
                    Book Courier
                  </Button>
                </HStack>
              </Stack>
            </GridItem>

            <GridItem>
              <Stack spacing={4}>
                <Box bg={subtleBg} borderRadius="lg" p={4}>
                  <Heading size="sm" mb={3}>
                    Value Summary
                  </Heading>
                  <Stack spacing={2} fontSize="sm">
                    <Flex justify="space-between"><Text>Product Subtotal</Text><Text fontWeight="700">{formatCurrency(subtotal)}</Text></Flex>
                    <Flex justify="space-between"><Text>Declared Value</Text><Text fontWeight="700">{formatCurrency(declaredValue)}</Text></Flex>
                    <Flex justify="space-between"><Text>Collectable Value</Text><Text fontWeight="800">{formatCurrency(collectableValue)}</Text></Flex>
                  </Stack>
                </Box>

                <Box borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={4}>
                  <Heading size="sm" mb={3}>
                    Courier Options
                  </Heading>
                  {fetchCouriers.isPending && <Spinner />}
                  {!fetchCouriers.isPending && couriers.length === 0 && (
                    <Text fontSize="sm" color="gray.500">
                      Check couriers after filling pickup, delivery, and parcel details.
                    </Text>
                  )}
                  <Stack spacing={3}>
                    {couriers.map((courier) => {
                      const optionKey = String(courier?.courier_option_key ?? getCourierId(courier))
                      const isSelected = selectedCourierKey === optionKey
                      return (
                        <Box
                          key={optionKey}
                          p={3}
                          borderWidth={isSelected ? '2px' : '1px'}
                          borderColor={isSelected ? 'blue.400' : borderColor}
                          borderRadius="md"
                          cursor={courier?.is_bookable === false ? 'not-allowed' : 'pointer'}
                          opacity={courier?.is_bookable === false ? 0.65 : 1}
                          onClick={() => {
                            if (courier?.is_bookable !== false) setSelectedCourierKey(optionKey)
                          }}
                        >
                          <Flex justify="space-between" gap={3}>
                            <Box>
                              <Text fontWeight="800">{getCourierName(courier)}</Text>
                              <Text fontSize="xs" color="gray.500">
                                Chargeable: {toNumber(courier?.chargeable_weight).toFixed(2)} kg
                              </Text>
                            </Box>
                            <Text fontWeight="900">{formatCurrency(getFinalCharge(courier))}</Text>
                          </Flex>
                          {courier?.is_bookable === false && (
                            <Badge mt={2} colorScheme="orange">Quote unavailable</Badge>
                          )}
                        </Box>
                      )
                    })}
                  </Stack>
                </Box>
              </Stack>
            </GridItem>
          </Grid>
        </Box>

        <Box bg={panelBg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={5}>
          <Flex justify="space-between" align="center" mb={4}>
            <HStack>
              <Icon as={FiUser} />
              <Heading size="md">Manual Booking Orders</Heading>
            </HStack>
            <Button size="sm" variant="outline" onClick={refetchOrders} isLoading={ordersFetching}>
              Refresh
            </Button>
          </Flex>
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Buyer</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th isNumeric>Amount</Th>
                  <Th>AWB</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(ordersData?.orders || []).map((order) => (
                  <Tr key={order.id}>
                    <Td fontWeight="700">{order.order_number}</Td>
                    <Td>{order.buyer_name}</Td>
                    <Td><Badge colorScheme={order.order_status === 'pending' ? 'orange' : 'blue'}>{order.order_status}</Badge></Td>
                    <Td>{String(order.order_type || '').toUpperCase()}</Td>
                    <Td isNumeric>{formatCurrency(order.order_amount)}</Td>
                    <Td>{order.awb_number || '-'}</Td>
                    <Td>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setCreatedOrder(order)}
                        isDisabled={order.order_status !== 'pending' || Boolean(order.awb_number)}
                      >
                        Select Draft
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          <Flex justify="space-between" align="center" mt={4}>
            <Text fontSize="sm" color="gray.500">
              {ordersData?.totalCount || 0} orders
            </Text>
            <HStack>
              <Button size="sm" onClick={() => setOrdersPage((p) => Math.max(1, p - 1))} isDisabled={ordersPage === 1}>
                Previous
              </Button>
              <Text fontSize="sm">Page {ordersPage}</Text>
              <Button
                size="sm"
                onClick={() => setOrdersPage((p) => p + 1)}
                isDisabled={ordersPage >= (ordersData?.totalPages || 1)}
              >
                Next
              </Button>
              <Select size="sm" w="90px" value={ordersLimit} onChange={(e) => setOrdersLimit(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </Select>
            </HStack>
          </Flex>
        </Box>
      </Stack>
    </Box>
  )
}

export default ManualBooking
