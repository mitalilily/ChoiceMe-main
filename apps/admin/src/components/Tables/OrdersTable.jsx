import {
  Badge,
  Box,
  Button,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { useCancelOrderMutation, useRegenerateOrderDocumentsMutation } from 'hooks/useOrders'
import { useMemo, useState } from 'react'
import { FiCopy, FiEye, FiMoreVertical, FiRefreshCw, FiTruck, FiXCircle } from 'react-icons/fi'
import { useHistory } from 'react-router-dom'
import { getCourierDisplayName } from 'utils/courierDisplay'
import { GenericTable } from 'views/Dashboard/Tables/components/GenericTable'
import OrderDetailsModal from './OrderDetailsModal'

const OrdersTable = ({
  orders,
  totalCount,
  page,
  setPage,
  perPage,
  setPerPage,
  loading = false,
  onRefresh,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const history = useHistory()
  const toast = useToast()
  const { mutateAsync: cancelOrderMutation, isPending: isCancelling } = useCancelOrderMutation()
  const {
    mutateAsync: regenerateDocuments,
    isPending: isRegenerating,
  } = useRegenerateOrderDocumentsMutation()

  const cancellableStatuses = useMemo(
    () => new Set(['pending', 'shipment_created', 'in_transit', 'pickup_initiated', 'booked']),
    [],
  )

  const supportedCancellationProviders = useMemo(() => new Set(['delhivery', 'deliveryone']), [])

  const captions = ['Order', 'AWB', 'Docs', 'Seller', 'Customer', 'Status', 'Type', 'Amount', 'Courier', 'Created']
  const columnKeys = [
    'order_number',
    'awb_number',
    'documents',
    'merchantName',
    'buyer_name',
    'order_status',
    'order_type',
    'order_amount',
    'courier_partner',
    'order_date',
  ]
  const actionsColumnWidth = '140px'
  const docsColumnWidth = '170px'

  const getStatusColor = (status) => {
    const statusColors = {
      pending: 'orange',
      shipment_created: 'blue',
      in_transit: 'purple',
      out_for_delivery: 'cyan',
      delivered: 'green',
      cancelled: 'red',
      cancellation_requested: 'yellow',
      rto: 'pink',
      rto_in_transit: 'purple',
      rto_delivered: 'gray',
    }
    return statusColors[status] || 'gray'
  }

  const getOrderTypeColor = (type) => {
    return type === 'cod' ? 'green' : 'blue'
  }

  const handleViewDetails = (order) => {
    setSelectedOrder(order)
    onOpen()
  }

  const handleOrderUpdated = (updatedOrder) => {
    setSelectedOrder(updatedOrder)
    if (onRefresh) onRefresh()
  }

  const handleCopyAWB = (awb) => {
    if (awb) {
      navigator.clipboard.writeText(awb)
    }
  }

  const handleTrackShipment = (order) => {
    if (!order?.awb_number) return
    history.push(`/admin/order-tracking?awb=${encodeURIComponent(order.awb_number)}`)
  }

  const canCancelShipment = (order) => {
    if (!order) return false
    const status = (order.order_status || '').toLowerCase()
    if (!cancellableStatuses.has(status)) return false
    const provider = (order.integration_type || '').toLowerCase()
    if (provider && !supportedCancellationProviders.has(provider)) return false
    return Boolean(order.id)
  }

  const handleCancelShipment = async (order) => {
    if (!order?.id) {
      toast({
        title: 'Unable to cancel order',
        description: 'Missing order identifier.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    try {
      await cancelOrderMutation(order.id)
      toast({
        title: 'Cancellation requested',
        description: `Order ${order.order_id || order.id} cancellation has been requested.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
      if (onRefresh) onRefresh()
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || 'Failed to request cancellation.'
      toast({
        title: 'Cancellation failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleRegenerateDocuments = async (order) => {
    if (!order?.id) {
      toast({
        title: 'Unable to regenerate',
        description: 'Missing order identifier.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    try {
      await regenerateDocuments({
        orderId: order.id,
        regenerateLabel: true,
        regenerateInvoice: true,
      })
      toast({
        title: 'Regenerated successfully',
        description: `Label and invoice regenerated for order ${order.order_number || order.id}.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
      if (onRefresh) onRefresh()
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Failed to regenerate documents.'
      toast({
        title: 'Regeneration failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const renderers = {
    order_number: (value, row) => (
      <Tooltip label={value || row?.id}>
        <Box maxW="120px">
          <Text fontSize="sm" fontWeight="700" noOfLines={1}>
            {value || 'N/A'}
          </Text>
          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {row?.id || 'No internal ID'}
          </Text>
        </Box>
      </Tooltip>
    ),
    merchantName: (value, row) => (
      <Box maxW="180px">
        <Button
          variant="link"
          colorScheme="blue"
          size="sm"
          h="auto"
          minH="unset"
          whiteSpace="normal"
          textAlign="left"
          onClick={() => {
            if (row?.user_id) {
              history.push(`/admin/users-management/${row.user_id}/overview`)
            } else {
              toast({
                title: 'Merchant details unavailable',
                description: 'User identifier missing for this order.',
                status: 'warning',
                duration: 4000,
                isClosable: true,
              })
            }
          }}
        >
          {value || row?.merchantEmail || row?.merchantPhone || 'Unknown Seller'}
        </Button>
        {row?.merchantEmail && (
          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {row.merchantEmail}
          </Text>
        )}
      </Box>
    ),
    awb_number: (value) => (
      <Flex align="center" gap={1.5} maxW="140px">
        <Text fontFamily="mono" fontSize="xs" noOfLines={1}>
          {value || 'N/A'}
        </Text>
        {value && (
          <Icon
            as={FiCopy}
            cursor="pointer"
            onClick={() => handleCopyAWB(value)}
            color="gray.500"
            _hover={{ color: 'blue.500' }}
          />
        )}
      </Flex>
    ),
    documents: (_value, row) => {
      const hasLabel = Boolean(String(row.label_url || row.label_key || row.label || '').trim())
      const hasInvoice = Boolean(
        String(row.invoice_url || row.invoice_key || row.invoice_link || '').trim(),
      )

      return (
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Badge colorScheme={hasLabel ? 'green' : 'orange'} borderRadius="full" px={2} py={0.5}>
            {hasLabel ? 'Label' : 'Label Pending'}
          </Badge>
          <Badge colorScheme={hasInvoice ? 'green' : 'orange'} borderRadius="full" px={2} py={0.5}>
            {hasInvoice ? 'Invoice' : 'Invoice Pending'}
          </Badge>
        </Stack>
      )
    },
    buyer_name: (value, row) => (
      <Box maxW="170px">
        <Text fontSize="sm" fontWeight="600" noOfLines={1}>
          {value || 'N/A'}
        </Text>
        {row.buyer_phone && (
          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {row.buyer_phone}
          </Text>
        )}
      </Box>
    ),
    order_status: (value) => (
      <Badge colorScheme={getStatusColor(value)} fontSize="0.72em" px={2} py={0.5} borderRadius="full">
        {String(value || 'unknown')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase())}
      </Badge>
    ),
    order_type: (value) => (
      <Badge
        colorScheme={getOrderTypeColor(value)}
        fontSize="0.72em"
        px={2}
        py={0.5}
        borderRadius="full"
      >
        {value?.toUpperCase()}
      </Badge>
    ),
    order_amount: (value) => (
      <Text fontSize="sm" fontWeight="700">
        {`\u20B9${parseFloat(value || 0).toFixed(2)}`}
      </Text>
    ),
    courier_partner: (value, row) => (
      <Tooltip
        label={getCourierDisplayName(
          {
            name: value,
            courier_id: row?.courier_id,
            integration_type: row?.integration_type,
          },
          'Not Assigned',
        )}
      >
        <Text fontSize="sm" noOfLines={2} maxW="130px">
          {getCourierDisplayName(
            {
              name: value,
              courier_id: row?.courier_id,
              integration_type: row?.integration_type,
            },
            'Not Assigned',
          )}
        </Text>
      </Tooltip>
    ),
    order_date: (value) => {
      if (!value) return 'N/A'
      const date = new Date(value)
      return (
        <Box>
          <Text fontSize="sm" fontWeight="600">
            {date.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {date.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Box>
      )
    },
  }

  const renderActions = (order) => (
    <Menu placement="bottom-end">
      <MenuButton as={Button} size="xs" variant="ghost" rightIcon={<FiMoreVertical />} minW="auto">
        More
      </MenuButton>
      <Portal>
        <MenuList zIndex={2000} boxShadow="xl">
          <MenuItem icon={<FiEye />} onClick={() => handleViewDetails(order)}>
            View Details
          </MenuItem>
          <MenuItem
            icon={<FiRefreshCw />}
            onClick={() => handleRegenerateDocuments(order)}
            isDisabled={isRegenerating}
          >
            Regenerate Label & Invoice
          </MenuItem>
          {order.awb_number && (
            <MenuItem icon={<FiTruck />} onClick={() => handleTrackShipment(order)}>
              Track Shipment
            </MenuItem>
          )}
          {canCancelShipment(order) && (
            <MenuItem
              icon={<FiXCircle />}
              onClick={() => handleCancelShipment(order)}
              isDisabled={isCancelling}
            >
              Cancel Shipment
            </MenuItem>
          )}
        </MenuList>
      </Portal>
    </Menu>
  )

  return (
    <>
      <GenericTable
        title="Orders Management"
        data={orders}
        captions={captions}
        columnKeys={columnKeys}
        renderers={renderers}
        renderActions={renderActions}
        loading={loading}
        paginated={true}
        page={page}
        setPage={setPage}
        totalCount={totalCount}
        perPage={perPage}
        setPerPage={setPerPage}
        perPageOptions={[10, 20, 50, 100]}
        actionsColumnWidth={actionsColumnWidth}
        density="compact"
        columnWidths={{
          order_number: '130px',
          awb_number: '150px',
          documents: docsColumnWidth,
          merchantName: '190px',
          buyer_name: '180px',
          order_status: '130px',
          order_type: '90px',
          order_amount: '105px',
          courier_partner: '140px',
          order_date: '130px',
        }}
      />

      {selectedOrder && (
        <OrderDetailsModal
          isOpen={isOpen}
          onClose={onClose}
          order={selectedOrder}
          onOrderUpdated={handleOrderUpdated}
        />
      )}
    </>
  )
}

export default OrdersTable
