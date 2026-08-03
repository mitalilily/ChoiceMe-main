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
  IconButton,
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
  MdLocalOffer,
  MdMoreHoriz,
  MdReceipt,
  MdSync,
  MdTrackChanges,
  MdVisibility,
} from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  fetchOrdersForCsvExport,
  generateManifestService,
  regenerateOrderDocumentsService,
} from '../../../api/order.service'
import {
  useB2COrdersByUser,
  useCancelShipment,
  useCreateReverseShipment,
  useDeleteB2COrder,
  useRegenerateOrderDocuments,
  useRequestB2CPickup,
  useSyncB2CTracking,
} from '../../../hooks/Orders/useOrders'
import { usePickupAddresses } from '../../../hooks/Pickup/usePickupAddresses'
import { usePresignedDownloadMutation } from '../../../hooks/Uploads/usePresignedDownloadUrls'
import { useKycVerification } from '../../../hooks/User/useKycVerification'
import { useLabelPreferences } from '../../../hooks/useLabelPreferences'
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
  downloadMergedPdf,
  type DocumentEntry,
  type DocumentType,
  type ResolvedDocumentEntry,
  getActionableErrorMessage,
  getB2CManifestIdentifier,
  getB2CManifestProvider,
  getDocumentReference,
  getDownloadFileName,
  generateMissingLabels,
  isB2CManifestEligible,
  isB2CCancelledStatus,
  summarizeMessages,
  summarizeOrderNumbers,
} from '../bulkActionUtils'
import { OrderExpandedRow } from '../OrderExpandedRow'
import OrderDetailsDialog from '../OrderDetailsDialog'
import ManifestScheduleDialog, {
  type ManifestSchedulePayload,
} from '../ManifestScheduleDialog'
import ReverseModal from '../reverse/ReverseModal'
import B2COrderFormSteps, { type B2CFormData } from './B2COrderForm'
import B2CSelectCourierDialog from './B2CSelectCourierDialog'
import { isB2CCancelEligible, isB2CPreShipmentDraft } from './orderActionRules'
import { getB2COrderFormDefaults } from './orderFormDefaults'

/* ───────────── Types ───────────── */
interface OrderFilters {
  status?: string | string[]
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

const toMoneyNumber = (value: unknown) => {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

const getB2CCustomerPaymentTotal = (order: B2COrder) =>
  Math.max(
    0,
    toMoneyNumber(order.order_amount) +
      toMoneyNumber(order.shipping_charges) +
      toMoneyNumber(order.transaction_fee) +
      toMoneyNumber(order.gift_wrap) -
      toMoneyNumber(order.discount) -
      toMoneyNumber(order.prepaid_amount),
  )

const orderStatusFilterTabs = [
  { label: 'New', value: 'new', statuses: ['pending'] },
  { label: 'Ready To Ship', value: 'ready_to_ship', statuses: ['booked', 'shipment_created'] },
  {
    label: 'Pickup & Manifests',
    value: 'pickup_manifests',
    statuses: ['pickup_initiated', 'manifest_generated'],
  },
  { label: 'In-Transit', value: 'in_transit', statuses: ['in_transit'] },
  { label: 'Out For Delivery', value: 'out_for_delivery', statuses: ['out_for_delivery'] },
  { label: 'Delivered', value: 'delivered', statuses: ['delivered'] },
  { label: 'Exception', value: 'exception', statuses: ['manifest_failed'] },
  { label: 'Undelivered', value: 'undelivered', statuses: ['ndr', 'undelivered'] },
  { label: 'RTO', value: 'rto', statuses: ['rto_initiated', 'rto', 'rto_in_transit', 'rto_delivered'] },
  { label: 'Lost', value: 'lost', statuses: ['lost'] },
  { label: 'Cancelled', value: 'cancelled', statuses: ['cancelled', 'cancellation_requested'] },
  { label: 'All', value: 'all', statuses: undefined },
] as const

type OrderStatusFilterValue = (typeof orderStatusFilterTabs)[number]['value']

const orderStatusFilterMap = orderStatusFilterTabs.reduce<
  Record<string, readonly string[] | undefined>
>((filters, tab) => {
  filters[tab.value] = tab.statuses
  return filters
}, {})

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
  undelivered: 'error',
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
  undelivered: 'Undelivered',
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
  const navigate = useNavigate()
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
  const [orderDetailsOrder, setOrderDetailsOrder] = useState<B2COrder | null>(null)
  const [editingOrder, setEditingOrder] = useState<B2COrder | null>(null)
  const [bulkFeedback, setBulkFeedback] = useState<BulkFeedback | null>(null)
  const [documentGenerationRef, setDocumentGenerationRef] = useState<string | null>(null)
  const [syncingTrackingOrderId, setSyncingTrackingOrderId] = useState<B2COrder['id'] | null>(null)
  const [filters, setFilters] = useState<OrderFilters>({
    status: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })
  const [selectedTab, setSelectedTab] = useState<OrderStatusFilterValue>('new')
  const selectedStatusFilter = orderStatusFilterMap[selectedTab]

  const effectiveFilters: OrderFilters = {
    ...filters,
    status: selectedStatusFilter ? [...selectedStatusFilter] : undefined,
    sortBy: filters.sortBy || 'created_at',
    sortOrder: filters.sortOrder || 'desc',
  }

  const { data, isLoading, isError } = useB2COrdersByUser(page, rowsPerPage, effectiveFilters)
  const { mutateAsync: requestB2CPickup, isPending: requestingPickup } = useRequestB2CPickup()
  const { mutateAsync: regenerateDocuments, isPending: regeneratingDocuments } =
    useRegenerateOrderDocuments()
  const { mutate: syncB2CTracking, isPending: syncingTracking } = useSyncB2CTracking()
  const queryClient = useQueryClient()
  const { preferences: labelPreferences } = useLabelPreferences()
  const { mutateAsync: presignDownloads } = usePresignedDownloadMutation()
  const { data: warehouses } = usePickupAddresses()
  const { mutate: cancelShipment, isPending: cancellingShipment } = useCancelShipment()
  const { mutate: createReverse } = useCreateReverseShipment()
  const { mutateAsync: deleteB2COrder, isPending: deletingB2COrder } = useDeleteB2COrder()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reverseOrder, setReverseOrder] = useState<any | null>(null)
  const [pickupScheduleOrder, setPickupScheduleOrder] = useState<B2COrder | null>(null)
  const [selectCourierOrder, setSelectCourierOrder] = useState<B2COrder | null>(null)

  useEffect(() => {
    setDrawerOpen(false)
    setOrderDrawerTitle('Create New B2C Order')
    setOrderFormDefaults(null)
    setReverseOrder(null)
    setManifestScheduleOpen(false)
    setPendingManifestRequest(null)
    setPickupScheduleOrder(null)
    setSelectCourierOrder(null)
    setDetailsOrder(null)
    setEditingOrder(null)
    setOrderDetailsOrder(null)
    setSyncingTrackingOrderId(null)
    setActionMenuAnchor(null)
    setActiveActionOrderId(null)
  }, [location.pathname, location.search, location.hash])

  const orders: B2COrder[] = data?.orders || []
  const selectedOrders: B2COrder[] = orders.filter((order) => selectedOrderIds.includes(order.id))
  const bulkLabelPdfLayout =
    labelPreferences?.printer_type === 'inkjet' && labelPreferences?.label_sheet_layout === 'a4_4up'
      ? 'a4_4up'
      : 'single'
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
        title: 'Manifest unavailable',
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
          title: 'Manifest completed with warnings',
          message: warningMessage,
        })
        toast.open({ message: warningMessage, severity: 'info' })
        return
      }
      setBulkFeedback({
        severity: 'success',
        title: 'Manifest completed',
        message: successMessage,
      })
      toast.open({ message: successMessage, severity: 'success' })
    } catch (error) {
      console.error('Manifest failed for order:', order.order_number, error)
      const errorMessage = getActionableErrorMessage(
        error,
        `Manifest failed for ${order.order_number}.`,
      )
      setBulkFeedback({
        severity: 'error',
        title: 'Manifest failed',
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

  const handleTrackShipment = (order: B2COrder) => {
    const awb = String(order.awb_number || '').trim()
    if (!awb) {
      toast.open({ message: 'AWB is not available for tracking yet.', severity: 'info' })
      return
    }

    navigate(`/tools/order_tracking?awb=${encodeURIComponent(awb)}`)
  }

  const handleSyncLiveStatus = (order: B2COrder) => {
    const orderId = String(order.id || '').trim()
    if (!orderId) {
      toast.open({ message: 'Order identifier is not available.', severity: 'error' })
      return
    }

    setSyncingTrackingOrderId(order.id)
    syncB2CTracking(orderId, {
      onSettled: () => {
        setSyncingTrackingOrderId((current) => (current === order.id ? null : current))
      },
    })
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
      setEditingOrder(null)
      setOrderFormKey((current) => current + 1)
      setDrawerOpen(true)
    })
  }

  const handleEditB2COrder = (order: B2COrder) => {
    if (!isB2CPreShipmentDraft(order)) {
      toast.open({
        message: 'Only draft orders that have not been shipped yet can be edited.',
        severity: 'warning',
      })
      return
    }

    setOrderDrawerTitle(`Edit Order ${order.order_number || ''}`.trim())
    setOrderFormDefaults(getB2COrderFormDefaults(order))
    setEditingOrder(order)
    setOrderFormKey((current) => current + 1)
    setDrawerOpen(true)
  }

  const handleCloneB2COrder = (order: B2COrder) => {
    const defaults = getB2COrderFormDefaults(order)
    checkKycBeforeAction(() => {
      setOrderDrawerTitle(`Clone Order ${order.order_number || ''}`.trim())
      setOrderFormDefaults({
        ...defaults,
        orderId: '',
        courierPartner: '',
        courierPartnerId: '',
        courierOptionKey: '',
      })
      setEditingOrder(null)
      setOrderFormKey((current) => current + 1)
      setDrawerOpen(true)
    })
  }

  const handleDeleteB2COrder = async (order: B2COrder) => {
    if (!isB2CPreShipmentDraft(order)) {
      toast.open({
        message: 'Only draft orders that have not been shipped yet can be deleted.',
        severity: 'warning',
      })
      return
    }

    const confirmed = window.confirm(
      `Delete draft order ${order.order_number || order.id}? This cannot be undone.`,
    )
    if (!confirmed) return

    try {
      await deleteB2COrder(String(order.id))
    } catch (error) {
      console.error('Draft order delete failed:', error)
    }
  }

  const handleTabChange = (newValue: OrderStatusFilterValue) => {
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

  const resolveDocumentEntries = async (documentEntries: DocumentEntry[]) => {
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

    let skippedCount = documentEntries.length - uniqueEntries.length
    const resolvedEntries: ResolvedDocumentEntry[] = directEntries.map((entry) => ({
      ...entry,
      url: String(entry.url),
    }))

    for (const [index, entry] of keyEntries.entries()) {
      const resolvedUrl = Array.isArray(presignedUrls) ? presignedUrls[index] : null
      if (!resolvedUrl) {
        skippedCount += 1
        continue
      }

      resolvedEntries.push({
        ...entry,
        url: resolvedUrl,
      })
    }

    return { resolvedEntries, skippedCount }
  }

  const downloadDocumentEntries = async (documentEntries: DocumentEntry[]) => {
    const { resolvedEntries, skippedCount } = await resolveDocumentEntries(documentEntries)
    let downloadedCount = 0

    for (const entry of resolvedEntries) {
      await downloadFile(entry.url, entry.fileName)
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
      let targetOrders = selectedOrders

      if (type === 'label') {
        const { preparedOrders, generatedCount, failures } = await generateMissingLabels(
          selectedOrders,
          async (order) => {
            const response = await regenerateOrderDocumentsService(String(order.id), {
              regenerateLabel: true,
              regenerateInvoice: false,
            })
            return response.data.label
          },
        )

        if (failures.length) {
          const failedOrders = summarizeOrderNumbers(
            failures.map(({ order }) => order.order_number || String(order.id)),
          )
          throw new Error(
            `Labels could not be generated for ${failures.length} selected order(s): ${failedOrders}. No partial PDF was downloaded.`,
          )
        }

        targetOrders = preparedOrders
        if (generatedCount) {
          setBulkFeedback({
            severity: 'info',
            title: 'Labels generated',
            message: `Generated ${generatedCount} missing label(s). Combining all ${selectedOrders.length} selected labels into one PDF.`,
          })
        }
      }

      const documentEntries = getDocumentEntriesForOrders(targetOrders, type)

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

      const { downloadedCount, skippedCount } =
        type === 'label'
          ? await (async () => {
              const { resolvedEntries, skippedCount: resolveSkippedCount } =
                await resolveDocumentEntries(documentEntries)
              const mergeResult = await downloadMergedPdf(
                resolvedEntries,
                `labels-${moment().format('YYYYMMDD-HHmmss')}.pdf`,
                { layout: bulkLabelPdfLayout },
              )

              return {
                downloadedCount: mergeResult.downloadedCount,
                skippedCount: resolveSkippedCount + mergeResult.skippedCount,
              }
            })()
          : await downloadDocumentEntries(documentEntries)

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
          ? type === 'label'
            ? `Downloaded ${downloadedCount} ${typeLabel.toLowerCase()} file(s) in one PDF. Skipped ${skippedCount} missing, duplicate, or unreadable file(s).`
            : `Downloaded ${downloadedCount} ${typeLabel.toLowerCase()} file(s). Skipped ${skippedCount} missing or duplicate file(s).`
          : type === 'label'
            ? `Downloaded ${downloadedCount} ${typeLabel.toLowerCase()} file(s) in one PDF.`
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

  const isCourierSelectionPending = (row: B2COrder) => {
    return isB2CPreShipmentDraft(row)
  }

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
      minWidth: 128,
      truncate: false,
      render: (_v, row) => (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography
            component="button"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setOrderDetailsOrder(row)
            }}
            sx={{
              all: 'unset',
              maxWidth: '100%',
              cursor: 'pointer',
              color: 'primary.dark',
              fontSize: 12.2,
              fontWeight: 600,
              lineHeight: 1.25,
              '&:hover': {
                textDecoration: 'underline',
              },
              '&:focus-visible': {
                outline: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                outlineOffset: '2px',
                borderRadius: '4px',
              },
            }}
            noWrap
          >
            {row.order_number || '-'}
          </Typography>
          <Typography sx={{ maxWidth: '100%', fontSize: 10.7, color: 'text.secondary', lineHeight: 1.25 }} noWrap>
            {formatOrderDateTime(row.created_at || row.order_date)}
          </Typography>
          <Typography sx={{ maxWidth: '100%', fontSize: 10.7, color: 'text.primary', lineHeight: 1.25 }} noWrap>
            {row.is_external_api ? 'API' : 'Custom'}
          </Typography>
        </Stack>
      ),
    },
    {
      label: 'Customer Details',
      id: 'buyer_name',
      minWidth: 176,
      truncate: false,
      render: (_value, row) => (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography sx={{ maxWidth: '100%', fontSize: 12.1, fontWeight: 500, color: 'text.primary', lineHeight: 1.28 }} noWrap>
            {row.buyer_name || '-'}
          </Typography>
          <Typography sx={{ maxWidth: '100%', fontSize: 10.9, color: 'text.secondary', lineHeight: 1.28 }} noWrap>
            {row.buyer_email || '-'}
          </Typography>
          <Typography sx={{ maxWidth: '100%', fontSize: 10.9, color: 'text.secondary', lineHeight: 1.28 }} noWrap>
            {row.buyer_phone || '-'}
          </Typography>
        </Stack>
      ),
    },
    {
      label: 'Product Details',
      id: 'products',
      minWidth: 112,
      truncate: false,
      render: (_value, row) => (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.1, fontWeight: 500, color: 'text.primary', maxWidth: '100%' }} noWrap>
            {getProductName(row)}
          </Typography>
          <Typography sx={{ fontSize: 10.9, color: 'text.primary', fontWeight: 500 }} noWrap>
            QTY:{getProductQuantity(row)}
          </Typography>
        </Stack>
      ),
    },
    {
      label: 'Package Details',
      id: 'weight',
      minWidth: 158,
      truncate: false,
      render: (_value, row) => {
        const applicableWeight =
          row.charged_weight ?? row.selected_max_slab_weight ?? row.volumetric_weight ?? row.weight
        return (
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography sx={{ maxWidth: '100%', fontSize: 10.8, color: 'text.secondary', lineHeight: 1.3 }} noWrap>
              Dead wt. :{formatKg(row.weight)}
            </Typography>
            <Typography sx={{ maxWidth: '100%', fontSize: 10.8, color: 'text.secondary', lineHeight: 1.3 }} noWrap>
              {formatDimensionValue(row.length)} X {formatDimensionValue(row.breadth)} X{' '}
              {formatDimensionValue(row.height)} (cm)
            </Typography>
            <Typography sx={{ maxWidth: '100%', fontSize: 10.8, color: 'text.secondary', lineHeight: 1.3 }} noWrap>
              Applicable wt. :{formatKg(applicableWeight)}
            </Typography>
          </Stack>
        )
      },
    },
    {
      label: 'Payment',
      id: 'order_amount',
      minWidth: 88,
      truncate: false,
      render: (_value, row) => {
        const isCod = String(row.order_type || '').toLowerCase() === 'cod'
        const paymentTotal = getB2CCustomerPaymentTotal(row)
        return (
          <Stack spacing={0.45} alignItems="flex-start">
            <Typography sx={{ fontSize: 12.1, color: 'text.primary', fontWeight: 500 }} noWrap>
              {formatCurrency(paymentTotal, 0)}
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
                  px: 0.5,
                  fontSize: 10,
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
      minWidth: 118,
      truncate: false,
      render: (_value, row) => (
        <Typography
          sx={{
            width: 'fit-content',
            maxWidth: '100%',
            fontSize: 12,
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
      minWidth: 84,
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
              px: 0.7,
              fontSize: 10,
              fontWeight: 600,
            },
          }}
        />
      ),
    },
    {
      label: 'Action',
      id: 'id',
      minWidth: 170,
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
        const isLabelGenerating = documentGenerationRef === `${row.id}-label`
        const isInvoiceGenerating = documentGenerationRef === `${row.id}-invoice`
        const isLabelDownloading = downloadingRowDocument === `${row.id}-label`
        const isInvoiceDownloading = downloadingRowDocument === `${row.id}-invoice`
        const isManifestDownloading = downloadingRowDocument === `${row.id}-manifest`
        const canDownloadLabel = hasDocument(row, 'label')
        const canDownloadInvoice = hasDocument(row, 'invoice')
        const canDownloadManifest = hasDocument(row, 'manifest')
        const isMenuOpen = activeActionOrderId === row.id && Boolean(actionMenuAnchor)
        const canSelectCourier = isCourierSelectionPending(row)
        const canEditDraft = isB2CPreShipmentDraft(row)
        const hasAwb = Boolean(String(row.awb_number || '').trim())
        const isSyncingThisOrder = syncingTracking && syncingTrackingOrderId === row.id

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
          <Stack direction="row" alignItems="center" spacing={0.55} sx={{ minWidth: 0 }}>
            <Button
              size="small"
              variant="contained"
              onClick={(event) => {
                event.stopPropagation()
                setSelectCourierOrder(row)
              }}
              disabled={isCancelled || !canSelectCourier}
              sx={{
                minWidth: 78,
                minHeight: 31,
                px: 1,
                borderRadius: '8px',
                fontSize: 11.4,
                fontWeight: 600,
                textTransform: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Ship Now
            </Button>
            <Tooltip title="More actions" arrow>
              <IconButton
                size="small"
                onClick={(event) => handleActionMenuOpen(event, row.id)}
                aria-haspopup="menu"
                aria-label={`Actions for ${row.order_number || 'order'}`}
                aria-expanded={isMenuOpen ? 'true' : undefined}
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  color: '#FFFFFF',
                  bgcolor: isMenuOpen ? '#5F646D' : '#7C818A',
                  '&:hover': {
                    bgcolor: '#5F646D',
                  },
                }}
              >
                <MdMoreHoriz size={22} />
              </IconButton>
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
                key: 'view-details',
                icon: <MdVisibility />,
                label: 'View Details',
                onClick: () => setOrderDetailsOrder(row),
              })}
              {canEditDraft &&
                renderActionItem({
                  key: 'edit-order',
                  icon: <MdEdit />,
                  label: 'Edit Order',
                  onClick: () => handleEditB2COrder(row),
                })}
              {renderActionItem({
                key: 'clone-order',
                icon: <MdContentCopy />,
                label: 'Clone Order',
                onClick: () => handleCloneB2COrder(row),
              })}
              {canEditDraft &&
                renderActionItem({
                  key: 'delete-order',
                  icon: <MdDelete />,
                  label: deletingB2COrder ? 'Deleting Order' : 'Delete Order',
                  onClick: () => handleDeleteB2COrder(row),
                  loading: deletingB2COrder,
                  danger: true,
                })}
              {renderActionItem({
                key: 'generate-manifest',
                icon: <MdAssignment />,
                label: isThisManifesting ? 'Generating Manifest' : 'Generate Manifest',
                onClick: () => openSingleManifestSchedule(row),
                disabled: !canManifest || bulkManifesting || Boolean(manifestingRef),
                loading: isThisManifesting,
              })}
              {renderActionItem({
                key: 'regenerate-label',
                icon: <MdLocalOffer />,
                label: isLabelGenerating ? 'Regenerating Label' : 'Regenerate Label',
                onClick: () => handleGenerateOrderDocument(row, 'label'),
                disabled:
                  isCancelled ||
                  !isDocumentReady ||
                  regeneratingDocuments ||
                  Boolean(documentGenerationRef),
                loading: isLabelGenerating,
              })}
              {renderActionItem({
                key: 'regenerate-invoice',
                icon: <MdReceipt />,
                label: isInvoiceGenerating ? 'Regenerating Invoice' : 'Regenerate Invoice',
                onClick: () => handleGenerateOrderDocument(row, 'invoice'),
                disabled:
                  isCancelled ||
                  !isDocumentReady ||
                  regeneratingDocuments ||
                  Boolean(documentGenerationRef),
                loading: isInvoiceGenerating,
              })}
              <Divider sx={{ my: 0.45 }} />
              {renderActionItem({
                key: 'download-label',
                icon: <MdFileDownload />,
                label: 'Download Label',
                onClick: () => handleSingleDocumentDownload(row, 'label'),
                disabled: !canDownloadLabel || Boolean(downloadingDocumentType) || Boolean(downloadingRowDocument),
                loading: isLabelDownloading,
              })}
              {renderActionItem({
                key: 'download-invoice',
                icon: <MdFileDownload />,
                label: 'Download Invoice',
                onClick: () => handleSingleDocumentDownload(row, 'invoice'),
                disabled: !canDownloadInvoice || Boolean(downloadingDocumentType) || Boolean(downloadingRowDocument),
                loading: isInvoiceDownloading,
              })}
              {renderActionItem({
                key: 'download-manifest',
                icon: <MdFileDownload />,
                label: 'Download Manifest',
                onClick: () => handleSingleDocumentDownload(row, 'manifest'),
                disabled: !canDownloadManifest || Boolean(downloadingDocumentType) || Boolean(downloadingRowDocument),
                loading: isManifestDownloading,
              })}
              <Divider sx={{ my: 0.45 }} />
              {renderActionItem({
                key: 'cancel-shipment',
                icon: <MdDelete />,
                label: cancellingShipment ? 'Cancelling Shipment' : 'Cancel Shipment',
                onClick: () => cancelShipment(String(row.id)),
                disabled: !isB2CCancelEligible(row) || cancellingShipment,
                loading: cancellingShipment,
                danger: true,
              })}
              {renderActionItem({
                key: 'track-shipment',
                icon: <MdTrackChanges />,
                label: 'Track Shipment',
                onClick: () => handleTrackShipment(row),
                disabled: !hasAwb,
              })}
              {renderActionItem({
                key: 'sync-live-status',
                icon: <MdSync />,
                label: isSyncingThisOrder ? 'Syncing Live Status' : 'Sync Live Status',
                onClick: () => handleSyncLiveStatus(row),
                disabled: !hasAwb || syncingTracking,
                loading: isSyncingThisOrder,
              })}
            </Menu>
          </Stack>
        )
      },
    },
  ]

  /* ───────────── Tabs ───────────── */
  const tabs = orderStatusFilterTabs.map((tab) => ({
    label: tab.label,
    value: tab.value,
    statusColor: 'success' as const,
  }))

  if (isError) {
    return (
      <Typography color="error" textAlign="center" py={4}>
        Failed to fetch orders
      </Typography>
    )
  }

  return (
    <Stack spacing={0.65} sx={{ pt: 0, pb: 0.5 }}>
      {/* Top row: Create button */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" gap={0.65}>
        <Box sx={{ width: { xs: '100%', sm: 176 } }}>
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
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.55} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            startIcon={exportingCsv ? <CircularProgress size={14} /> : <MdDownload />}
            onClick={handleExportCsv}
            disabled={exportingCsv}
            sx={{ minHeight: 32, px: 1.35, fontSize: 12, textTransform: 'none', fontWeight: 600 }}
          >
            {exportingCsv ? 'Exporting' : 'Export CSV'}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateB2COrder}
            sx={{ minHeight: 32, px: 1.35, fontSize: 12, textTransform: 'none', fontWeight: 600 }}
          >
            Create B2C Order
          </Button>
        </Stack>
      </Stack>

      {/* 🔹 Status Tabs Row */}
      <SmartTabs
        tabs={tabs}
        value={selectedTab}
        onChange={handleTabChange}
        compact
        desktopVisibleCount={7}
      />

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
            p: 0.95,
            borderRadius: '8px',
            border: '1px solid rgba(51, 51, 105, 0.14)',
            backgroundColor: 'rgba(51, 51, 105, 0.04)',
          }}
        >
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            alignItems={{ xs: 'flex-start', lg: 'center' }}
            justifyContent="space-between"
            gap={0.9}
          >
            <Box>
              <Typography sx={{ fontWeight: 600, color: '#333369', fontSize: '14px' }}>
                {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
              </Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '11.5px', mt: 0.15 }}>
                Manifest up to {BULK_MANIFEST_LIMIT} eligible orders at once. Bulk label, invoice,
                and manifest downloads have no selection limit.
              </Typography>
              {manifestValidationMessage && (
                <Typography sx={{ color: '#C0392B', fontSize: '12px', mt: 0.5 }}>
                  {manifestValidationMessage}
                </Typography>
              )}
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.55} flexWrap="wrap">
              <Button
                variant="contained"
                onClick={openBulkManifestSchedule}
                disabled={bulkManifesting || Boolean(manifestValidationMessage)}
                sx={{ textTransform: 'none', minWidth: 142, minHeight: 31, fontSize: 11.5 }}
              >
                {bulkManifesting ? 'Manifesting...' : 'Manifest Selected'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleBulkDownload('label')}
                disabled={downloadingDocumentType !== null}
                sx={{ textTransform: 'none', minHeight: 31, fontSize: 11.5 }}
              >
                {downloadingDocumentType === 'label' ? 'Downloading...' : 'Download Labels'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleBulkDownload('invoice')}
                disabled={downloadingDocumentType !== null}
                sx={{ textTransform: 'none', minHeight: 31, fontSize: 11.5 }}
              >
                {downloadingDocumentType === 'invoice' ? 'Downloading...' : 'Download Invoices'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleBulkDownload('manifest')}
                disabled={downloadingDocumentType !== null}
                sx={{ textTransform: 'none', minHeight: 31, fontSize: 11.5 }}
              >
                {downloadingDocumentType === 'manifest' ? 'Downloading...' : 'Download Manifests'}
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  clearSelection()
                  setBulkFeedback(null)
                }}
                sx={{ textTransform: 'none', minHeight: 31, fontSize: 11.5 }}
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
            : 'Generate Manifest'
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

      <B2CSelectCourierDialog
        open={Boolean(selectCourierOrder)}
        order={selectCourierOrder}
        onClose={() => setSelectCourierOrder(null)}
      />

      <OrderDetailsDialog
        open={Boolean(orderDetailsOrder)}
        order={orderDetailsOrder}
        onClose={() => setOrderDetailsOrder(null)}
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
          setEditingOrder(null)
          setOrderDrawerTitle('Create New B2C Order')
        }}
        title={orderDrawerTitle}
      >
        <B2COrderFormSteps
          key={orderFormKey}
          initialValues={orderFormDefaults || undefined}
          mode={editingOrder ? 'edit' : 'create'}
          existingOrderId={editingOrder?.id ? String(editingOrder.id) : null}
          onClose={() => {
            setDrawerOpen(false)
            setOrderFormDefaults(null)
            setEditingOrder(null)
            setOrderDrawerTitle('Create New B2C Order')
          }}
        />
      </CustomDrawer>
    </Stack>
  )
}

export default B2COrdersList
