import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertTitle,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import moment from 'moment'
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import {
  MdAssignment,
  MdContentCopy,
  MdDelete,
  MdDownload,
  MdEdit,
  MdFileDownload,
  MdKeyboardArrowDown,
  MdLocalOffer,
  MdReceipt,
} from 'react-icons/md'
import { useLocation } from 'react-router-dom'
import { fetchOrdersForCsvExport, generateManifestService } from '../../../api/order.service'
import {
  useB2COrdersByUser,
  useCancelShipment,
  useCreateReverseShipment,
  useRegenerateOrderDocuments,
  useRequestB2CPickup,
} from '../../../hooks/Orders/useOrders'
import { usePickupAddresses } from '../../../hooks/Pickup/usePickupAddresses'
import { usePresignedDownloadMutation } from '../../../hooks/Uploads/usePresignedDownloadUrls'
import { useKycVerification } from '../../../hooks/User/useKycVerification'
import type { B2COrder } from '../../../types/generic.types'
import {
  DELHIVERY_COURIER_FILTER_OPTIONS_BY_NAME,
} from '../../../utils/courierDisplay'
import { downloadClientOrdersCsv } from '../../../utils/orderCsvExport'
import { FilterBar, type FilterField } from '../../FilterBar'
import { toast } from '../../UI/Toast'
import CustomDrawer from '../../UI/drawer/CustomDrawer'
import { SmartTabs } from '../../UI/tab/Tabs'
import DataTable, { type Column } from '../../UI/table/DataTable'
import TableSkeleton from '../../UI/table/TableSkeleton'
import CustomSelect from '../../UI/inputs/CustomSelect'
import {
  BULK_MANIFEST_LIMIT,
  downloadFile,
  type DocumentEntry,
  type DocumentType,
  getActionableErrorMessage,
  getB2CManifestIdentifier,
  getB2CManifestProvider,
  getDocumentReference,
  getDownloadFileName,
  isB2CManifestEligible,
  isB2CCancelledStatus,
  summarizeMessages,
  summarizeOrderNumbers,
} from '../bulkActionUtils'
import { OrderExpandedRow } from '../OrderExpandedRow'
import ManifestScheduleDialog, {
  type ManifestSchedulePayload,
} from '../ManifestScheduleDialog'
import ReverseModal from '../reverse/ReverseModal'
import B2COrderFormSteps, { type B2CFormData } from './B2COrderForm'
import { isB2CCancelEligible } from './orderActionRules'

/* ───────────── Types ───────────── */
interface OrderFilters {
  status?: string
  sortBy?: 'created_at'
  sortOrder?: 'asc' | 'desc'
  type?: string
  courier?: string
  warehouse?: string
  fromDate?: string
  toDate?: string
  search?: string
}

type BulkFeedback = {
  severity: 'info' | 'success' | 'error' | 'warning'
  title: string
  message: string
}

type PendingManifestRequest =
  | { mode: 'single'; order: B2COrder }
  | { mode: 'bulk' }
  | null

/* ───────────── Status Color Mapping ───────────── */
const documentButtonMeta: Record<DocumentType, { label: string; icon: ReactNode }> = {
  label: { label: 'Label', icon: <MdLocalOffer /> },
  invoice: { label: 'Invoice', icon: <MdReceipt /> },
  manifest: { label: 'Manifest', icon: <MdAssignment /> },
}

const documentGenerationStatuses = new Set([
  'booked',
  'shipment_created',
  'pickup_initiated',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'ndr',
  'undelivered',
  'rto',
  'rto_in_transit',
  'rto_delivered',
])

const actionMenuItemSx = {
  minHeight: 38,
  px: 1.25,
  py: 0.75,
  gap: 0.75,
  color: 'text.primary',
  fontWeight: 400,
  '&:hover': {
    bgcolor: 'rgba(51, 51, 105, 0.06)',
  },
  '&.Mui-disabled': {
    opacity: 0.48,
  },
}

const actionMenuDangerItemSx = {
  ...actionMenuItemSx,
  color: 'error.main',
  '& .MuiListItemIcon-root': {
    color: 'error.main',
  },
}

const actionMenuIconSx = {
  minWidth: 28,
  color: 'text.secondary',
  '& svg': {
    fontSize: 18,
  },
}

export const statusColorMap: Record<string, 'success' | 'pending' | 'error' | 'info'> = {
  pending: 'pending',
  booked: 'info',
  manifest_failed: 'error',
  pickup_initiated: 'pending',
  shipment_created: 'info', // legacy
  in_transit: 'pending',
  out_for_delivery: 'pending',
  delivered: 'success',
  cancelled: 'error',
  ndr: 'error',
  rto_initiated: 'error',
  rto: 'error',
  rto_in_transit: 'pending',
  rto_delivered: 'info',
  cancellation_requested: 'info',
  manifest_generated: 'info', // legacy
}

/* ───────────── Shipping Statuses ───────────── */
const shippingStatusMap: Record<string, string> = {
  pending: 'Pending',
  booked: 'Booked',
  manifest_failed: 'Manifest Failed',
  pickup_initiated: 'Scheduled for Pickup',
  shipment_created: 'Shipment Created',
  in_transit: 'In Transit',
  out_for_delivery: 'Out For Delivery',
  delivered: 'Delivered',
  ndr: 'NDR',
  rto_initiated: 'RTO Initiated',
  rto: 'RTO Initiated',
  rto_in_transit: 'RTO In Transit',
  rto_delivered: 'RTO Delivered',
  cancellation_requested: 'Cancellation Requested',
  cancelled: 'Cancelled',
}

const B2COrdersList = () => {
  const theme = useTheme()
  const location = useLocation()
  const isXs = useMediaQuery(theme.breakpoints.down('sm')) // mobile
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md')) // tablet
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg')) // small desktop
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg')) // large desktop

  let drawerWidth: string | number = '100%' // default full width
  if (isXs) drawerWidth = '100%' // mobile full width
  else if (isSm) drawerWidth = '95%' // tablets
  else if (isMd) drawerWidth = '95%' // small desktops
  else if (isLgUp) drawerWidth = 1200 // large desktop fixed width
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [orderDrawerTitle, setOrderDrawerTitle] = useState('Create New B2C Order')
  const [orderFormDefaults, setOrderFormDefaults] = useState<Partial<B2CFormData> | null>(null)
  const [orderFormKey, setOrderFormKey] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Array<B2COrder['id']>>([])
  const [selectionResetToken, setSelectionResetToken] = useState(0)
  const [downloadingDocumentType, setDownloadingDocumentType] = useState<DocumentType | null>(null)
  const [downloadingRowDocument, setDownloadingRowDocument] = useState<string | null>(null)
  const [bulkManifesting, setBulkManifesting] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [manifestingRef, setManifestingRef] = useState<string | null>(null)
  const [pendingManifestRequest, setPendingManifestRequest] =
    useState<PendingManifestRequest>(null)
  const [manifestScheduleOpen, setManifestScheduleOpen] = useState(false)
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null)
  const [activeActionOrderId, setActiveActionOrderId] = useState<B2COrder['id'] | null>(null)
  const [detailsOrder, setDetailsOrder] = useState<B2COrder | null>(null)
  const [bulkFeedback, setBulkFeedback] = useState<BulkFeedback | null>(null)
  const [documentGenerationRef, setDocumentGenerationRef] = useState<string | null>(null)
  const [filters, setFilters] = useState<OrderFilters>({
    status: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })
  const [selectedTab, setSelectedTab] = useState<string>('')

  const effectiveFilters: OrderFilters = {
    ...filters,
    status: selectedTab || undefined,
    sortBy: filters.sortBy || 'created_at',
    sortOrder: filters.sortOrder || 'desc',
  }

  const { data, isLoading, isError } = useB2COrdersByUser(page, rowsPerPage, effectiveFilters)
  const { mutateAsync: requestB2CPickup, isPending: requestingPickup } = useRequestB2CPickup()
  const { mutateAsync: regenerateDocuments, isPending: regeneratingDocuments } =
    useRegenerateOrderDocuments()
  const queryClient = useQueryClient()
  const { mutateAsync: presignDownloads } = usePresignedDownloadMutation()
  const { data: warehouses } = usePickupAddresses()
  const { mutate: cancelShipment, isPending: cancellingShipment } = useCancelShipment()
  const { mutate: createReverse } = useCreateReverseShipment()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reverseOrder, setReverseOrder] = useState<any | null>(null)
  const [pickupScheduleOrder, setPickupScheduleOrder] = useState<B2COrder | null>(null)

  useEffect(() => {
    setDrawerOpen(false)
    setOrderDrawerTitle('Create New B2C Order')
    setOrderFormDefaults(null)
    setReverseOrder(null)
    setManifestScheduleOpen(false)
    setPendingManifestRequest(null)
    setPickupScheduleOrder(null)
    setDetailsOrder(null)
    setActionMenuAnchor(null)
    setActiveActionOrderId(null)
  }, [location.pathname, location.search, location.hash])

  const orders: B2COrder[] = data?.orders || []
  const selectedOrders: B2COrder[] = orders.filter((order) => selectedOrderIds.includes(order.id))
  const manifestValidationMessage =
    selectedOrders.length === 0
      ? 'Select orders to start a bulk action.'
      : selectedOrders.length > BULK_MANIFEST_LIMIT
        ? `You can manifest a maximum of ${BULK_MANIFEST_LIMIT} orders at a time.`
        : selectedOrders.some((order) => !isB2CManifestEligible(order))
          ? 'Some selected orders are not ready for manifest yet.'
          : ''

  const clearSelection = () => {
    setSelectedOrderIds([])
    setSelectionResetToken((current) => current + 1)
  }

  /* ───────────── Handlers ───────────── */
  const handleExportCsv = async () => {
    try {
      setExportingCsv(true)
      const exportRows = await fetchOrdersForCsvExport('b2c', effectiveFilters)
      downloadClientOrdersCsv(exportRows, 'b2c')
      toast.open({
        message: `${exportRows.length} B2C order${exportRows.length === 1 ? '' : 's'} exported to CSV.`,
        severity: 'success',
      })
    } catch (error) {
      console.error('B2C order CSV export failed:', error)
      toast.open({ message: 'Failed to export B2C orders CSV. Please try again.', severity: 'error' })
    } finally {
      setExportingCsv(false)
    }
  }

  const handleActionMenuOpen = (
    event: MouseEvent<HTMLElement>,
    orderId: B2COrder['id'],
  ) => {
    event.stopPropagation()
    setActionMenuAnchor(event.currentTarget)
    setActiveActionOrderId(orderId)
  }

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null)
    setActiveActionOrderId(null)
  }

  const runActionFromMenu = (
    event: MouseEvent<HTMLElement>,
    action: () => void | Promise<void>,
  ) => {
    event.stopPropagation()
    handleActionMenuClose()
    void action()
  }

  const handleViewDetails = (order: B2COrder) => {
    setDetailsOrder(order)
  }

  const handleGenerateManifest = async (
    order: B2COrder,
    schedule: ManifestSchedulePayload,
  ) => {
    const manifestRef = getB2CManifestIdentifier(order)
    if (!manifestRef) {
      const message = `Manifest cannot be started for ${order.order_number} yet.`
      setBulkFeedback({
        severity: 'error',
        title: 'Manifest unavailable',
        message,
      })
      toast.open({ message, severity: 'error' })
      return
    }
    const providerKey = getB2CManifestProvider(order)
    const shouldRequestPickupFirst = ['deliveryone', 'delhivery'].includes(providerKey)
    if (shouldRequestPickupFirst && !order.id) {
      const message = `Pickup cannot be scheduled for ${order.order_number} because the order identifier is missing.`
      setBulkFeedback({
        severity: 'error',
        title: 'Ship Now unavailable',
        message,
      })
      toast.open({ message, severity: 'error' })
      return
    }
    try {
      setManifestingRef(manifestRef)
      setBulkFeedback({
        severity: 'info',
        title: shouldRequestPickupFirst ? 'Scheduling pickup' : 'Manifest in progress',
        message: shouldRequestPickupFirst
          ? `Sending pickup request for ${order.order_number}.`
          : `Processing ${order.order_number}.`,
      })
      if (shouldRequestPickupFirst) {
        await requestB2CPickup({
          orderId: String(order.id),
          ...schedule,
        })
        setBulkFeedback({
          severity: 'info',
          title: 'Generating PDFs',
          message: `Pickup scheduled for ${order.order_number}. Generating documents now.`,
        })
      }
      const response = await generateManifestService({
        awbs: [manifestRef],
        type: 'b2c',
        ...schedule,
        skip_pickup_request: shouldRequestPickupFirst,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ])
      const successMessage = shouldRequestPickupFirst
        ? `Pickup scheduled and PDFs generated for ${order.order_number}.`
        : `Manifest completed for ${order.order_number}.`
      const warningSummary = summarizeMessages(response.warnings || [])
      if (warningSummary) {
        const warningMessage = `${successMessage} ${warningSummary}`
        setBulkFeedback({
          severity: 'warning',
          title: shouldRequestPickupFirst
            ? 'Ship Now completed with warnings'
            : 'Manifest completed with warnings',
          message: warningMessage,
        })
        toast.open({ message: warningMessage, severity: 'info' })
        return
      }
      setBulkFeedback({
        severity: 'success',
        title: shouldRequestPickupFirst ? 'Ship Now completed' : 'Manifest completed',
        message: successMessage,
      })
      toast.open({ message: successMessage, severity: 'success' })
    } catch (error) {
      console.error('Ship Now failed for order:', order.order_number, error)
      const errorMessage = getActionableErrorMessage(
        error,
        `Ship Now failed for ${order.order_number}.`,
      )
      setBulkFeedback({
        severity: 'error',
        title: shouldRequestPickupFirst ? 'Ship Now failed' : 'Manifest failed',
        message: `${order.order_number}: ${errorMessage}`,
      })
      toast.open({
        message: `${order.order_number}: ${errorMessage}`,
        severity: 'error',
      })
    } finally {
      setManifestingRef((current) => (current === manifestRef ? null : current))
    }
  }

  const handleGenerateOrderDocument = async (order: B2COrder, type: 'label' | 'invoice') => {
    const orderId = String(order.id || '').trim()
    if (!orderId) {
      toast.open({ message: 'Order identifier is not available.', severity: 'error' })
      return
    }

    if (!isDocumentGenerationReady(order)) {
      toast.open({
        message: 'Generate the manifest before creating label or invoice documents.',
        severity: 'info',
      })
      return
    }

    const documentRef = `${order.id}-${type}`
    try {
      setDocumentGenerationRef(documentRef)
      await regenerateDocuments({
        orderId,
        regenerateLabel: type === 'label',
        regenerateInvoice: type === 'invoice',
      })
    } catch (error) {
      console.error(`Failed to generate ${type} for order:`, order.order_number, error)
    } finally {
      setDocumentGenerationRef((current) => (current === documentRef ? null : current))
    }
  }

  const handleRequestPickup = async (
    order: B2COrder,
    schedule: ManifestSchedulePayload,
  ) => {
    if (!order.id) return
    const orderId = String(order.id)
    try {
      const response = await requestB2CPickup({
        orderId,
        ...schedule,
      })
      const message = response.message || `Pickup scheduled for ${order.order_number}.`
      setBulkFeedback({
        severity: 'success',
        title: 'Pickup scheduled',
        message,
      })
    } catch (error) {
      console.error('Pickup request failed:', error)
    }
  }

  const handlePickupScheduleConfirm = async (schedule: ManifestSchedulePayload) => {
    if (!pickupScheduleOrder) return
    const order = pickupScheduleOrder
    setPickupScheduleOrder(null)
    await handleRequestPickup(order, schedule)
  }

  const handleApplyFilters = (appliedFilters: OrderFilters) => {
    // Merge while preserving current status unless explicitly set
    setFilters((prev) => ({
      ...prev,
      ...appliedFilters,
      status: appliedFilters.status !== undefined ? appliedFilters.status : prev.status,
      sortBy: appliedFilters.sortBy !== undefined ? appliedFilters.sortBy : prev.sortBy,
      sortOrder: appliedFilters.sortOrder !== undefined ? appliedFilters.sortOrder : prev.sortOrder,
    }))
    setPage(1)
    clearSelection()
    setBulkFeedback(null)
  }

  const { checkKycBeforeAction } = useKycVerification()

  const handleCreateB2COrder = () => {
    checkKycBeforeAction(() => {
      setOrderDrawerTitle('Create New B2C Order')
      setOrderFormDefaults(null)
      setOrderFormKey((current) => current + 1)
      setDrawerOpen(true)
    })
  }

  const handleCloneOrder = (order: B2COrder) => {
    const products = getOrderProducts(order)
    const generatedOrderNumber = `${order.order_number || 'ORDER'}-COPY-${Date.now().toString().slice(-4)}`
    setOrderDrawerTitle(`Clone Order ${order.order_number || ''}`.trim())
    setOrderFormDefaults({
      buyerName: order.buyer_name || '',
      buyerPhone: order.buyer_phone || '',
      buyerEmail: order.buyer_email || '',
      address: order.address || '',
      pincode: order.pincode || '',
      city: order.city || '',
      state: order.state || '',
      country: order.country || 'India',
      products: products.length
        ? products.map((product) => ({
            productName: String(product.productName ?? product.name ?? ''),
            price: Number(product.price ?? 0),
            quantity: Number(product.quantity ?? product.qty ?? 1),
            sku: String(product.sku ?? ''),
            hsnCode: String(product.hsnCode ?? product.hsn ?? ''),
            discount: Number(product.discount ?? 0),
            taxRate: Number(product.taxRate ?? product.tax_rate ?? 0),
          }))
        : [{ productName: '', price: 0, quantity: 1 }],
      weight: normalizeKgValue(order.weight),
      length: Number(order.length ?? 0),
      breadth: Number(order.breadth ?? 0),
      height: Number(order.height ?? 0),
      orderId: generatedOrderNumber,
      orderDate: moment().format('YYYY-MM-DD'),
      orderType: order.order_type || 'prepaid',
      shippingCharges: Number(order.shipping_charges ?? 0),
      transactionFee: Number(order.transaction_fee ?? 0),
      giftWrap: Number(order.gift_wrap ?? 0),
      discount: Number(order.discount ?? 0),
      prepaidAmount: Number(order.prepaid_amount ?? 0),
      pickupLocationId: order.pickup_location_id || '',
      pickupLocationName: order.pickup_details?.warehouse_name || order.pickup_details?.name || '',
      pickupLocationPincode: order.pickup_details?.pincode || '',
      pickupLocationPOCName: order.pickup_details?.name || '',
      pickupLocationPOCPhone: order.pickup_details?.phone || '',
      pickupCity: order.pickup_details?.city || '',
      pickupState: order.pickup_details?.state || '',
      pickupAddress: order.pickup_details?.address || '',
    })
    setOrderFormKey((current) => current + 1)
    setDrawerOpen(true)
  }

  const handleTabChange = (newValue: string) => {
    setSelectedTab(newValue)
    setPage(1)
    clearSelection()
    setBulkFeedback(null)
    setFilters((prev) => ({
      ...prev,
      sortBy: prev.sortBy || 'created_at',
      sortOrder: prev.sortOrder || 'desc',
    }))

    // Keep status filtering local; do not sync status to URL params.
  }

  const closeManifestSchedule = () => {
    if (bulkManifesting || manifestingRef) return
    setManifestScheduleOpen(false)
    setPendingManifestRequest(null)
  }

  const openSingleManifestSchedule = (order: B2COrder) => {
    setPendingManifestRequest({ mode: 'single', order })
    setManifestScheduleOpen(true)
  }

  const openBulkManifestSchedule = () => {
    if (!selectedOrders.length) {
      const message = 'Select up to 5 eligible orders to manifest.'
      setBulkFeedback({
        severity: 'error',
        title: 'No orders selected',
        message,
      })
      toast.open({ message, severity: 'error' })
      return
    }

    if (manifestValidationMessage) {
      setBulkFeedback({
        severity: 'error',
        title: 'Manifest unavailable',
        message: manifestValidationMessage,
      })
      toast.open({ message: manifestValidationMessage, severity: 'error' })
      return
    }

    setPendingManifestRequest({ mode: 'bulk' })
    setManifestScheduleOpen(true)
  }

  const handleManifestScheduleConfirm = async (schedule: ManifestSchedulePayload) => {
    const request = pendingManifestRequest
    if (!request) return

    setManifestScheduleOpen(false)
    setPendingManifestRequest(null)

    if (request.mode === 'single') {
      await handleGenerateManifest(request.order, schedule)
    } else {
      await handleBulkManifest(schedule)
    }
  }

  const handleBulkManifest = async (schedule: ManifestSchedulePayload) => {
    if (!selectedOrders.length) {
      const message = 'Select up to 5 eligible orders to manifest.'
      setBulkFeedback({
        severity: 'error',
        title: 'No orders selected',
        message,
      })
      toast.open({ message, severity: 'error' })
      return
    }

    if (manifestValidationMessage) {
      setBulkFeedback({
        severity: 'error',
        title: 'Manifest unavailable',
        message: manifestValidationMessage,
      })
      toast.open({ message: manifestValidationMessage, severity: 'error' })
      return
    }

    setBulkManifesting(true)
    setBulkFeedback({
      severity: 'info',
      title: 'Manifest in progress',
      message: `Processing ${selectedOrders.length} selected order(s).`,
    })

    try {
      const manifestGroups = selectedOrders.reduce<Record<string, B2COrder[]>>((groups, order) => {
        const manifestIdentifier = getB2CManifestIdentifier(order)
        if (!manifestIdentifier) return groups

        const providerKey = getB2CManifestProvider(order)
        if (!groups[providerKey]) groups[providerKey] = []
        groups[providerKey].push(order)
        return groups
      }, {})

      const failedOrders: B2COrder[] = []
      const failureReasons: string[] = []
      const warningMessages: string[] = []
      let successCount = 0

      for (const [providerKey, providerOrders] of Object.entries(manifestGroups)) {
        const identifiers = providerOrders
          .map((order) => getB2CManifestIdentifier(order))
          .filter((value): value is string => Boolean(value))

        if (!identifiers.length) continue

        try {
          const response = await generateManifestService({
            awbs: identifiers,
            type: 'b2c',
            ...schedule,
          })
          successCount += providerOrders.length
          if (response.warnings?.length) {
            warningMessages.push(...response.warnings)
          }
        } catch (error) {
          console.error('Bulk manifest provider batch failed:', error)
          failedOrders.push(...providerOrders)
          failureReasons.push(
            `${providerKey}: ${getActionableErrorMessage(
              error,
              'Manifest could not be completed for this batch.',
            )}`,
          )
        }
      }

      if (successCount > 0) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] }),
          queryClient.invalidateQueries({ queryKey: ['orders'] }),
        ])
      }

      if (failedOrders.length > 0) {
        const failedOrderIds = failedOrders.map((order) => order.id)
        const failedOrderNumbers = summarizeOrderNumbers(
          failedOrders.map((order) => order.order_number || order.id),
        )
        const message =
          successCount > 0
            ? `Completed ${successCount} order(s). Failed for ${failedOrders.length}: ${failedOrderNumbers}. ${failureReasons.join(' ')}`
            : `Failed for ${failedOrders.length} order(s): ${failedOrderNumbers}. ${failureReasons.join(' ')}`
        const warningSummary = summarizeMessages(warningMessages)
        const finalMessage = warningSummary ? `${message} ${warningSummary}` : message

        setSelectedOrderIds(failedOrderIds)
        setBulkFeedback({
          severity: successCount > 0 ? 'warning' : 'error',
          title: successCount > 0 ? 'Manifest partially completed' : 'Manifest failed',
          message: finalMessage,
        })
        toast.open({ message: finalMessage, severity: 'error' })
        return
      }

      const successMessage = `Manifest completed for ${successCount} order(s).`
      const warningSummary = summarizeMessages(warningMessages)
      if (warningSummary) {
        const warningMessage = `${successMessage} ${warningSummary}`
        setBulkFeedback({
          severity: 'warning',
          title: 'Manifest completed with warnings',
          message: warningMessage,
        })
        toast.open({ message: warningMessage, severity: 'info' })
        clearSelection()
        return
      }
      setBulkFeedback({
        severity: 'success',
        title: 'Manifest completed',
        message: successMessage,
      })
      toast.open({ message: successMessage, severity: 'success' })
      clearSelection()
    } finally {
      setBulkManifesting(false)
    }
  }

  const getDocumentEntriesForOrders = (targetOrders: B2COrder[], type: DocumentType) =>
    targetOrders.reduce((entries: DocumentEntry[], order: B2COrder) => {
      const { key, url } = getDocumentReference(order, type)
      if (!key && !url) return entries

      const source = key || url
      entries.push({
        key,
        url,
        fileName: getDownloadFileName(order, type, source),
      })
      return entries
    }, [])

  const downloadDocumentEntries = async (documentEntries: DocumentEntry[]) => {
    const uniqueEntries = Array.from(
      new Map<string, DocumentEntry>(
        documentEntries.map((entry) => [entry.key || entry.url || entry.fileName, entry]),
      ).values(),
    )

    const keyEntries = uniqueEntries.filter(
      (entry): entry is DocumentEntry & { key: string } => Boolean(entry.key),
    )
    const directEntries = uniqueEntries.filter(
      (entry): entry is DocumentEntry & { url: string } => !entry.key && Boolean(entry.url),
    )
    const presignedUrls = keyEntries.length
      ? await presignDownloads({ keys: keyEntries.map((entry) => String(entry.key)) })
      : []

    let downloadedCount = 0
    let skippedCount = documentEntries.length - uniqueEntries.length

    for (const entry of directEntries) {
      await downloadFile(String(entry.url), entry.fileName)
      downloadedCount += 1
    }

    for (const [index, entry] of keyEntries.entries()) {
      const resolvedUrl = Array.isArray(presignedUrls) ? presignedUrls[index] : null
      if (!resolvedUrl) {
        skippedCount += 1
        continue
      }

      await downloadFile(resolvedUrl, entry.fileName)
      downloadedCount += 1
    }

    return { downloadedCount, skippedCount }
  }

  const handleBulkDownload = async (type: DocumentType) => {
    const typeLabel = documentButtonMeta[type].label
    const typePlural = `${typeLabel.toLowerCase()}s`

    if (!selectedOrders.length) {
      const message = 'Select at least one order to download documents.'
      setBulkFeedback({
        severity: 'error',
        title: 'No orders selected',
        message,
      })
      toast.open({ message, severity: 'error' })
      return
    }

    setDownloadingDocumentType(type)
    setBulkFeedback({
      severity: 'info',
      title: `Downloading ${typePlural}`,
      message: `Preparing ${selectedOrders.length} selected order(s) for ${typeLabel.toLowerCase()} download.`,
    })

    try {
      const documentEntries = getDocumentEntriesForOrders(selectedOrders, type)

      if (!documentEntries.length) {
        const message = `No ${typeLabel.toLowerCase()} files are available for the selected orders.`
        setBulkFeedback({
          severity: 'error',
          title: `No ${typeLabel.toLowerCase()} files found`,
          message,
        })
        toast.open({ message, severity: 'error' })
        return
      }

      const { downloadedCount, skippedCount } = await downloadDocumentEntries(documentEntries)

      if (!downloadedCount) {
        const message = `No ${typeLabel.toLowerCase()} files could be downloaded for the selected orders.`
        setBulkFeedback({
          severity: 'error',
          title: `${typeLabel} download failed`,
          message,
        })
        toast.open({ message, severity: 'error' })
        return
      }

      const summaryMessage =
        skippedCount > 0
          ? `Downloaded ${downloadedCount} ${typeLabel.toLowerCase()} file(s). Skipped ${skippedCount} missing or duplicate file(s).`
          : `Downloaded ${downloadedCount} ${typeLabel.toLowerCase()} file(s).`

      setBulkFeedback({
        severity: skippedCount > 0 ? 'warning' : 'success',
        title:
          skippedCount > 0
            ? `${typeLabel} download completed with skips`
            : `${typeLabel} download completed`,
        message: summaryMessage,
      })
      toast.open({ message: summaryMessage, severity: skippedCount > 0 ? 'info' : 'success' })
    } catch (error) {
      console.error(`Bulk ${type} download failed:`, error)
      const message = getActionableErrorMessage(
        error,
        `Failed to download selected ${typeLabel.toLowerCase()} files. Please try again.`,
      )
      setBulkFeedback({
        severity: 'error',
        title: `${typeLabel} download failed`,
        message,
      })
      toast.open({ message, severity: 'error' })
    } finally {
      setDownloadingDocumentType(null)
    }
  }

  const handleSingleDocumentDownload = async (order: B2COrder, type: DocumentType) => {
    const typeLabel = documentButtonMeta[type].label
    const rowDownloadKey = `${order.id}-${type}`

    try {
      setDownloadingRowDocument(rowDownloadKey)
      const documentEntries = getDocumentEntriesForOrders([order], type)

      if (!documentEntries.length) {
        toast.open({
          message: `${typeLabel} is not available for ${order.order_number} yet.`,
          severity: 'error',
        })
        return
      }

      const { downloadedCount } = await downloadDocumentEntries(documentEntries)

      if (!downloadedCount) {
        toast.open({
          message: `${typeLabel} could not be downloaded for ${order.order_number}.`,
          severity: 'error',
        })
        return
      }

      toast.open({
        message: `${typeLabel} downloaded for ${order.order_number}.`,
        severity: 'success',
      })
    } catch (error) {
      console.error(`${typeLabel} download failed:`, error)
      const message = getActionableErrorMessage(
        error,
        `Failed to download ${typeLabel.toLowerCase()} for ${order.order_number}. Please try again.`,
      )
      toast.open({ message, severity: 'error' })
    } finally {
      setDownloadingRowDocument(null)
    }
  }

  /* ───────────── Filter Fields ───────────── */
  const filterFields: FilterField[] = [
    {
      name: 'search',
      label: 'Search',
      type: 'text',
      placeholder: 'Search by customer, order # etc.',
    },
    {
      name: 'type',
      label: 'Order Type',
      type: 'select',
      options: [
        { label: 'All', value: '' },
        { label: 'COD', value: 'cod' },
        { label: 'Prepaid', value: 'prepaid' },
      ],
      isAdvanced: true,
    },
    {
      name: 'courier',
      label: 'Courier',
      type: 'select',
      options: DELHIVERY_COURIER_FILTER_OPTIONS_BY_NAME,
      isAdvanced: true,
    },
    {
      name: 'warehouse',
      label: 'Warehouse',
      type: 'select',
      options:
        warehouses?.pickupAddresses
          ?.map((w) => {
            const nickname = String(w.pickup?.addressNickname || '').trim()
            return nickname ? { label: nickname, value: nickname } : null
          })
          .filter((option): option is { label: string; value: string } => Boolean(option)) ?? [],
      isAdvanced: true,
    },
    { name: 'fromDate', label: 'From Date', type: 'date', placeholder: 'From' },
    { name: 'toDate', label: 'To Date', type: 'date', placeholder: 'To' },
  ]

  const defaultFilterValues: Record<string, unknown> = {
    sortBy: 'created_at',
    sortOrder: 'desc',
    ...filters,
  }

  /* ───────────── Columns ───────────── */
  const formatCurrency = (value?: number | string | null, decimals = 2) =>
    `Rs ${Number(value ?? 0).toFixed(decimals)}`

  const normalizeKgValue = (value?: number | string | null) => {
    const numericValue = Number(value ?? 0)
    if (!Number.isFinite(numericValue) || numericValue <= 0) return 0
    return numericValue > 50 ? numericValue / 1000 : numericValue
  }

  const formatKg = (value?: number | string | null) => `${normalizeKgValue(value).toFixed(1)} Kg`

  const formatDimensionValue = (value?: number | string | null) => {
    const numericValue = Number(value ?? 0)
    if (!Number.isFinite(numericValue) || numericValue <= 0) return '0'
    return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1)
  }

  const formatOrderDateTime = (value?: string | null) => {
    if (!value) return '-'
    const date = moment(value)
    return date.isValid() ? date.format('DD MMM YYYY | hh:mm A') : '-'
  }

  const getOrderProducts = (row: B2COrder): Array<Record<string, unknown>> => {
    const rawProducts: unknown = row.products
    if (Array.isArray(rawProducts)) return rawProducts as Array<Record<string, unknown>>
    if (typeof rawProducts === 'string') {
      try {
        const parsedProducts: unknown = JSON.parse(rawProducts)
        return Array.isArray(parsedProducts) ? parsedProducts as Array<Record<string, unknown>> : []
      } catch {
        return []
      }
    }
    return []
  }

  const getProductName = (row: B2COrder) => {
    const products = getOrderProducts(row)
    const firstProduct = products[0]
    const rawName = String(firstProduct?.productName ?? firstProduct?.name ?? '').trim()
    if (!rawName) return '-'
    return products.length > 1 ? `${rawName} +${products.length - 1}` : rawName
  }

  const getProductQuantity = (row: B2COrder) => {
    const products = getOrderProducts(row)
    const quantity = products.reduce((sum, product) => {
      const productQuantity = Number(product.quantity ?? product.qty ?? 0)
      return sum + (Number.isFinite(productQuantity) ? productQuantity : 0)
    }, 0)
    return Math.max(quantity, 1)
  }

  const getPickupAddressName = (row: B2COrder) =>
    String(row.pickup_details?.warehouse_name || row.pickup_details?.name || '-').trim() || '-'

  const getDisplayStatusLabel = (status?: string | null) => {
    const normalizedStatus = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (normalizedStatus === 'pending') return 'NEW'
    return shippingStatusMap[normalizedStatus] || status || 'Unknown'
  }

  const isPickupRequestOrder = (row: B2COrder) =>
    ['deliveryone', 'delhivery'].includes(getB2CManifestProvider(row))

  const shouldShowManifestShipmentCount =
    pendingManifestRequest?.mode === 'single'
      ? isPickupRequestOrder(pendingManifestRequest.order)
      : selectedOrders.some(isPickupRequestOrder)

  const defaultManifestShipmentCount =
    pendingManifestRequest?.mode === 'single'
      ? 1
      : Math.max(1, selectedOrders.filter(isPickupRequestOrder).length || selectedOrders.length)

  const hasDocument = (row: B2COrder, type: DocumentType) => {
    const { key, url } = getDocumentReference(row, type)
    return Boolean(key || url)
  }

  const isDocumentGenerationReady = (row: B2COrder) => {
    const normalizedStatus = String(row.order_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    return (
      Boolean(String(row.manifest_key || row.manifest || row.awb_number || '').trim()) ||
      documentGenerationStatuses.has(normalizedStatus)
    )
  }

  const columns: Column<B2COrder>[] = [
    {
      label: 'Order Details',
      id: 'order_number',
      minWidth: 180,
      truncate: false,
      render: (_v, row) => (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'primary.dark', lineHeight: 1.25 }} noWrap>
            {row.order_number || '-'}
          </Typography>
          <Typography sx={{ fontSize: 11.2, color: 'text.secondary', lineHeight: 1.25 }} noWrap>
            {formatOrderDateTime(row.created_at || row.order_date)}
          </Typography>
          <Typography sx={{ fontSize: 11.2, color: 'text.primary', lineHeight: 1.25 }} noWrap>
            {row.is_external_api ? 'API' : 'Custom'}
          </Typography>
        </Stack>
      ),
    },
    {
      label: 'Customer Details',
      id: 'buyer_name',
      minWidth: 230,
      truncate: false,
      render: (_value, row) => (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: 'text.primary', lineHeight: 1.28 }} noWrap>
            {row.buyer_name || '-'}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.28 }} noWrap>
            {row.buyer_email || '-'}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.28 }} noWrap>
            {row.buyer_phone || '-'}
          </Typography>
        </Stack>
      ),
    },
    {
      label: 'Product Details',
      id: 'products',
      minWidth: 150,
      truncate: false,
      render: (_value, row) => (
        <Stack spacing={0.25}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: 'text.primary', maxWidth: 150 }} noWrap>
            {getProductName(row)}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.primary', fontWeight: 500 }}>
            QTY:{getProductQuantity(row)}
          </Typography>
        </Stack>
      ),
    },
    {
      label: 'Package Details',
      id: 'weight',
      minWidth: 200,
      truncate: false,
      render: (_value, row) => {
        const applicableWeight =
          row.charged_weight ?? row.selected_max_slab_weight ?? row.volumetric_weight ?? row.weight
        return (
          <Stack spacing={0.25}>
            <Typography sx={{ fontSize: 11.7, color: 'text.secondary', lineHeight: 1.3 }}>
              Dead wt. :{formatKg(row.weight)}
            </Typography>
            <Typography sx={{ fontSize: 11.7, color: 'text.secondary', lineHeight: 1.3 }}>
              {formatDimensionValue(row.length)} X {formatDimensionValue(row.breadth)} X{' '}
              {formatDimensionValue(row.height)} (cm)
            </Typography>
            <Typography sx={{ fontSize: 11.7, color: 'text.secondary', lineHeight: 1.3 }}>
              Applicable wt. :{formatKg(applicableWeight)}
            </Typography>
          </Stack>
        )
      },
    },
    {
      label: 'Payment',
      id: 'order_amount',
      minWidth: 118,
      truncate: false,
      render: (_value, row) => {
        const isCod = String(row.order_type || '').toLowerCase() === 'cod'
        return (
          <Stack spacing={0.45} alignItems="flex-start">
            <Typography sx={{ fontSize: 12.5, color: 'text.primary', fontWeight: 500 }}>
              {formatCurrency(row.order_amount, 0)}
            </Typography>
            <Chip
              label={isCod ? 'COD' : 'Prepaid'}
              size="small"
              sx={{
                height: 22,
                px: 0.65,
                borderRadius: '999px',
                color: isCod ? 'warning.dark' : 'primary.dark',
                bgcolor: isCod ? alpha(theme.palette.warning.main, 0.12) : alpha(theme.palette.primary.main, 0.12),
                border: `1px solid ${isCod ? alpha(theme.palette.warning.dark, 0.24) : alpha(theme.palette.primary.dark, 0.2)}`,
                '& .MuiChip-label': {
                  px: 0.65,
                  fontSize: 10.5,
                  fontWeight: 600,
                },
              }}
            />
          </Stack>
        )
      },
    },
    {
      label: 'Pickup Address',
      id: 'pickup_location_id',
      minWidth: 150,
      truncate: false,
      render: (_value, row) => (
        <Typography
          sx={{
            width: 'fit-content',
            maxWidth: 145,
            fontSize: 12.5,
            color: 'text.primary',
            fontWeight: 500,
            borderBottom: `1px dashed ${alpha(theme.palette.text.primary, 0.28)}`,
            lineHeight: 1.3,
          }}
          noWrap
        >
          {getPickupAddressName(row)}
        </Typography>
      ),
    },
    {
      label: 'Status',
      id: 'order_status',
      minWidth: 112,
      truncate: false,
      render: (_value, row) => (
        <Chip
          label={getDisplayStatusLabel(row.order_status)}
          size="small"
          sx={{
            height: 25,
            minWidth: 58,
            borderRadius: '999px',
            color: 'secondary.main',
            bgcolor: alpha(theme.palette.secondary.main, 0.08),
            border: `1px solid ${alpha(theme.palette.secondary.main, 0.24)}`,
            '& .MuiChip-label': {
              px: 0.9,
              fontSize: 10.5,
              fontWeight: 600,
            },
          }}
        />
      ),
    },
    {
      label: 'Action',
      id: 'id',
      minWidth: 198,
      sticky: 'right',
      stickyOffset: 0,
      truncate: false,
      render: (_value, row) => {
        const orderStatus = String(row.order_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
        const rowManifestRef = getB2CManifestIdentifier(row)
        const canManifest = isB2CManifestEligible(row)
        const isThisManifesting = Boolean(rowManifestRef && manifestingRef === rowManifestRef)
        const isCancelled = isB2CCancelledStatus(orderStatus)
        const isDocumentReady = isDocumentGenerationReady(row)
        const isInvoiceGenerating = documentGenerationRef === `${row.id}-invoice`
        const isInvoiceDownloading = downloadingRowDocument === `${row.id}-invoice`
        const canDownloadInvoice = hasDocument(row, 'invoice')
        const isMenuOpen = activeActionOrderId === row.id && Boolean(actionMenuAnchor)

        const renderActionItem = ({
          key,
          icon,
          label,
          onClick,
          disabled = false,
          loading = false,
          danger = false,
        }: {
          key: string
          icon: ReactNode
          label: string
          onClick: () => void | Promise<void>
          disabled?: boolean
          loading?: boolean
          danger?: boolean
        }) => (
          <MenuItem
            key={key}
            disabled={disabled || loading}
            onClick={(event) => runActionFromMenu(event, onClick)}
            sx={danger ? actionMenuDangerItemSx : actionMenuItemSx}
          >
            <ListItemIcon sx={danger ? { ...actionMenuIconSx, color: 'error.main' } : actionMenuIconSx}>
              {loading ? <CircularProgress size={16} /> : icon}
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
            />
          </MenuItem>
        )

        return (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              size="small"
              variant="contained"
              onClick={(event) => {
                event.stopPropagation()
                openSingleManifestSchedule(row)
              }}
              disabled={isCancelled || !canManifest || bulkManifesting || isThisManifesting}
              sx={{
                minWidth: 92,
                minHeight: 34,
                px: 1.45,
                borderRadius: '8px',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {isThisManifesting ? 'Shipping' : 'Ship Now'}
            </Button>
            <Tooltip title="More actions" arrow>
              <Button
                size="small"
                variant="outlined"
                onClick={(event) => handleActionMenuOpen(event, row.id)}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen ? 'true' : undefined}
                endIcon={<MdKeyboardArrowDown size={17} />}
                sx={{
                  minWidth: 86,
                  minHeight: 34,
                  px: 1.1,
                  borderRadius: '8px',
                  borderColor: isMenuOpen
                    ? 'secondary.main'
                    : alpha(theme.palette.secondary.main, 0.24),
                  color: 'secondary.main',
                  bgcolor: isMenuOpen ? alpha(theme.palette.secondary.main, 0.08) : '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  '& .MuiButton-endIcon': {
                    ml: 0.35,
                  },
                  '&:hover': {
                    borderColor: 'secondary.main',
                    bgcolor: alpha(theme.palette.secondary.main, 0.08),
                  },
                }}
              >
                Actions
              </Button>
            </Tooltip>
            <Menu
              anchorEl={actionMenuAnchor}
              open={isMenuOpen}
              onClose={handleActionMenuClose}
              onClick={(event) => event.stopPropagation()}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 0.75,
                    minWidth: 238,
                    borderRadius: '8px',
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.12)}`,
                    background: '#FFFFFF',
                    boxShadow: `0 18px 38px ${alpha(theme.palette.secondary.main, 0.18)}`,
                    overflow: 'hidden',
                  },
                },
                list: {
                  dense: true,
                  sx: { py: 0.55 },
                },
              }}
            >
              {renderActionItem({
                key: 'download-invoice',
                icon: <MdFileDownload />,
                label: 'Download Invoice',
                onClick: () => handleSingleDocumentDownload(row, 'invoice'),
                disabled: !canDownloadInvoice || Boolean(downloadingDocumentType) || Boolean(downloadingRowDocument),
                loading: isInvoiceDownloading,
              })}
              {renderActionItem({
                key: 'generate-invoice',
                icon: <MdReceipt />,
                label: isInvoiceGenerating ? 'Generating New Invoice' : 'Generate New Invoice',
                onClick: () => handleGenerateOrderDocument(row, 'invoice'),
                disabled:
                  isCancelled ||
                  !isDocumentReady ||
                  regeneratingDocuments ||
                  Boolean(documentGenerationRef),
                loading: isInvoiceGenerating,
              })}
              {renderActionItem({
                key: 'edit-order',
                icon: <MdEdit />,
                label: 'Edit Order',
                onClick: () => {
                  handleViewDetails(row)
                  toast.open({
                    message: 'Order details opened. Backend edit logic was not changed.',
                    severity: 'info',
                  })
                },
              })}
              {renderActionItem({
                key: 'delete-order',
                icon: <MdDelete />,
                label: cancellingShipment ? 'Deleting Order' : 'Delete Order',
                onClick: () => cancelShipment(String(row.id)),
                disabled: !isB2CCancelEligible(row) || cancellingShipment,
                loading: cancellingShipment,
                danger: true,
              })}
              <Divider sx={{ my: 0.45 }} />
              {renderActionItem({
                key: 'clone-order',
                icon: <MdContentCopy />,
                label: 'Clone Order',
                onClick: () => handleCloneOrder(row),
              })}
            </Menu>
          </Stack>
        )
      },
    },
  ]

  /* ───────────── Tabs ───────────── */
  const tabs = [
    { label: 'All', value: '' },
    ...Object.entries(shippingStatusMap).map(([value, label]) => ({
      label,
      value,
    })),
  ]

  if (isError) {
    return (
      <Typography color="error" textAlign="center" py={4}>
        Failed to fetch orders
      </Typography>
    )
  }

  return (
    <Stack spacing={1.1} sx={{ pt: 0 }}>
      {/* Top row: Create button */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" gap={1}>
        <Box sx={{ width: { xs: '100%', sm: 190 } }}>
          <CustomSelect
            label="Sort by Created At"
            value={filters.sortOrder || 'desc'}
            onSelect={(value) => {
              const sortOrder = (value as 'asc' | 'desc') || 'desc'
              setFilters((prev) => ({ ...prev, sortBy: 'created_at', sortOrder }))
              setPage(1)
              clearSelection()
              setBulkFeedback(null)
            }}
            items={[
              { key: 'asc', label: 'Newest first' },
              { key: 'desc', label: 'Oldest first' },
            ]}
          />
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            startIcon={exportingCsv ? <CircularProgress size={14} /> : <MdDownload />}
            onClick={handleExportCsv}
            disabled={exportingCsv}
            sx={{ minHeight: 36, px: 1.6, textTransform: 'none', fontWeight: 600 }}
          >
            {exportingCsv ? 'Exporting' : 'Export CSV'}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateB2COrder}
            sx={{ minHeight: 36, px: 1.6, textTransform: 'none', fontWeight: 600 }}
          >
            Create B2C Order
          </Button>
        </Stack>
      </Stack>

      {/* 🔹 Status Tabs Row */}
      <SmartTabs tabs={tabs} value={selectedTab} onChange={handleTabChange} compact />

      {/* 🔹 Advanced Filter Bar */}
      <FilterBar
        fields={filterFields}
        onApply={handleApplyFilters}
        defaultValues={defaultFilterValues}
        appliedCount={Object.values(filters).filter(Boolean).length}
        compact
      />

      {bulkFeedback && (
        <Alert
          severity={bulkFeedback.severity}
          onClose={() => setBulkFeedback(null)}
          sx={{ alignItems: 'flex-start' }}
        >
          <AlertTitle>{bulkFeedback.title}</AlertTitle>
          {bulkFeedback.message}
        </Alert>
      )}

      {selectedOrders.length > 0 && (
        <Box
          sx={{
            p: 1.25,
            borderRadius: '8px',
            border: '1px solid rgba(51, 51, 105, 0.14)',
            backgroundColor: 'rgba(51, 51, 105, 0.04)',
          }}
        >
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            alignItems={{ xs: 'flex-start', lg: 'center' }}
            justifyContent="space-between"
            gap={1.25}
          >
            <Box>
              <Typography sx={{ fontWeight: 600, color: '#333369', fontSize: '14px' }}>
                {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
              </Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '12px', mt: 0.25 }}>
                Manifest up to {BULK_MANIFEST_LIMIT} eligible orders at once. Bulk label, invoice,
                and manifest downloads have no selection limit.
              </Typography>
              {manifestValidationMessage && (
                <Typography sx={{ color: '#C0392B', fontSize: '12px', mt: 0.5 }}>
                  {manifestValidationMessage}
                </Typography>
              )}
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} flexWrap="wrap">
              <Button
                variant="contained"
                onClick={openBulkManifestSchedule}
                disabled={bulkManifesting || Boolean(manifestValidationMessage)}
                sx={{ textTransform: 'none', minWidth: 150, minHeight: 34, fontSize: 12 }}
              >
                {bulkManifesting ? 'Manifesting...' : 'Manifest Selected'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleBulkDownload('label')}
                disabled={downloadingDocumentType !== null}
                sx={{ textTransform: 'none', minHeight: 34, fontSize: 12 }}
              >
                {downloadingDocumentType === 'label' ? 'Downloading...' : 'Download Labels'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleBulkDownload('invoice')}
                disabled={downloadingDocumentType !== null}
                sx={{ textTransform: 'none', minHeight: 34, fontSize: 12 }}
              >
                {downloadingDocumentType === 'invoice' ? 'Downloading...' : 'Download Invoices'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleBulkDownload('manifest')}
                disabled={downloadingDocumentType !== null}
                sx={{ textTransform: 'none', minHeight: 34, fontSize: 12 }}
              >
                {downloadingDocumentType === 'manifest' ? 'Downloading...' : 'Download Manifests'}
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  clearSelection()
                  setBulkFeedback(null)
                }}
                sx={{ textTransform: 'none', minHeight: 34, fontSize: 12 }}
              >
                Clear
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* 🔹 Data Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <DataTable<B2COrder>
          rows={orders}
          columns={columns}
          title="B2C Orders"
          pagination
          selectable
          density="compact"
          tableVariant="shipment"
          maxHeight={640}
          currentPage={page}
          defaultRowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          totalCount={data?.totalCount || 0}
          onPageChange={(newPage) => {
            setPage(newPage + 1)
            clearSelection()
            setBulkFeedback(null)
          }}
          bgOverlayImg="/images/orders-bg.png"
          onRowsPerPageChange={(newLimit) => {
            setRowsPerPage(newLimit)
            setPage(1)
            clearSelection()
            setBulkFeedback(null)
          }}
          onSelectRows={(ids) => setSelectedOrderIds(ids)}
          selectedRowIds={selectedOrderIds}
          selectionResetToken={selectionResetToken}
        />
      )}

      <ReverseModal
        open={Boolean(reverseOrder)}
        order={reverseOrder}
        onClose={() => setReverseOrder(null)}
        onConfirm={(payload) => {
          createReverse(payload)
          setReverseOrder(null)
        }}
      />

      <ManifestScheduleDialog
        open={manifestScheduleOpen}
        loading={bulkManifesting || Boolean(manifestingRef)}
        defaultShipmentCount={defaultManifestShipmentCount}
        showShipmentCount={shouldShowManifestShipmentCount}
        title={
          pendingManifestRequest?.mode === 'bulk'
            ? 'Schedule Selected Manifests'
            : 'Ship Now'
        }
        description={
          pendingManifestRequest?.mode === 'bulk'
            ? 'Choose the pickup date and time before sending this manifest to the courier.'
            : 'Enter the pickup request details. PDFs will be generated after the pickup is accepted.'
        }
        onClose={closeManifestSchedule}
        onConfirm={handleManifestScheduleConfirm}
      />

      <ManifestScheduleDialog
        open={Boolean(pickupScheduleOrder)}
        loading={requestingPickup}
        title="Schedule Pickup"
        description="Choose the pickup date and time before sending the pickup request to the courier."
        onClose={() => {
          if (!requestingPickup) setPickupScheduleOrder(null)
        }}
        onConfirm={handlePickupScheduleConfirm}
      />

      <CustomDrawer
        width={isXs ? '100%' : 820}
        open={Boolean(detailsOrder)}
        onClose={() => setDetailsOrder(null)}
        title={detailsOrder?.order_number ? `Order ${detailsOrder.order_number}` : 'Order Details'}
      >
        {detailsOrder && <OrderExpandedRow row={detailsOrder} />}
      </CustomDrawer>

      <CustomDrawer
        width={drawerWidth}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setOrderFormDefaults(null)
          setOrderDrawerTitle('Create New B2C Order')
        }}
        title={orderDrawerTitle}
      >
        <B2COrderFormSteps
          key={orderFormKey}
          initialValues={orderFormDefaults || undefined}
          onClose={() => {
            setDrawerOpen(false)
            setOrderFormDefaults(null)
            setOrderDrawerTitle('Create New B2C Order')
          }}
        />
      </CustomDrawer>
    </Stack>
  )
}

export default B2COrdersList
