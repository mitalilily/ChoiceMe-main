import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertTitle,
  alpha,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Link,
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
  MdCancel,
  MdEventAvailable,
  MdKeyboardReturn,
  MdLocalOffer,
  MdLocalShipping,
  MdMoreVert,
  MdReceipt,
  MdReplay,
  MdSync,
  MdVisibility,
} from 'react-icons/md'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { generateManifestService } from '../../../api/order.service'
import {
  useB2COrdersByUser,
  useCancelShipment,
  useCreateReverseShipment,
  useRegenerateOrderDocuments,
  useRequestB2CPickup,
  useRetryFailedManifest,
  useSyncB2CTracking,
} from '../../../hooks/Orders/useOrders'
import { usePickupAddresses } from '../../../hooks/Pickup/usePickupAddresses'
import { usePresignedDownloadMutation } from '../../../hooks/Uploads/usePresignedDownloadUrls'
import { useKycVerification } from '../../../hooks/User/useKycVerification'
import type { B2COrder } from '../../../types/generic.types'
import {
  DELHIVERY_COURIER_FILTER_OPTIONS_BY_NAME,
  getCourierDisplayName,
} from '../../../utils/courierDisplay'
import { FilterBar, type FilterField } from '../../FilterBar'
import { toast } from '../../UI/Toast'
import StatusChip from '../../UI/chip/StatusChip'
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
import B2COrderFormSteps from './B2COrderForm'
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
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Array<B2COrder['id']>>([])
  const [selectionResetToken, setSelectionResetToken] = useState(0)
  const [downloadingDocumentType, setDownloadingDocumentType] = useState<DocumentType | null>(null)
  const [downloadingRowDocument, setDownloadingRowDocument] = useState<string | null>(null)
  const [bulkManifesting, setBulkManifesting] = useState(false)
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
  const { mutateAsync: retryFailedManifest, isPending: retryingManifest } = useRetryFailedManifest()
  const { mutateAsync: syncB2CTracking } = useSyncB2CTracking()
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
  const [syncingTrackingOrderId, setSyncingTrackingOrderId] = useState<string | null>(null)
  const [pickupScheduleOrder, setPickupScheduleOrder] = useState<B2COrder | null>(null)
  const [requestingPickupOrderId, setRequestingPickupOrderId] = useState<string | null>(null)

  useEffect(() => {
    setDrawerOpen(false)
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

  const handleTrackShipment = (order: B2COrder) => {
    const awb = String(order.awb_number || '').trim()
    if (!awb) {
      toast.open({ message: 'AWB number is not available for this order.', severity: 'info' })
      return
    }
    navigate(`/tools/order_tracking?awb=${encodeURIComponent(awb)}`)
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
    try {
      setManifestingRef(manifestRef)
      setBulkFeedback({
        severity: 'info',
        title: 'Manifest in progress',
        message: `Processing ${order.order_number}.`,
      })
      const response = await generateManifestService({
        awbs: [manifestRef],
        type: 'b2c',
        ...schedule,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ])
      const successMessage = `Manifest completed for ${order.order_number}.`
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

  const handleRetryManifest = async (order: B2COrder) => {
    if (!order.id) return
    await retryFailedManifest(String(order.id))
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

  const handleSyncTracking = async (order: B2COrder) => {
    if (!order.id) return
    const orderId = String(order.id)
    try {
      setSyncingTrackingOrderId(orderId)
      await syncB2CTracking(orderId)
    } finally {
      setSyncingTrackingOrderId((current) => (current === orderId ? null : current))
    }
  }

  const handleRequestPickup = async (
    order: B2COrder,
    schedule: ManifestSchedulePayload,
  ) => {
    if (!order.id) return
    const orderId = String(order.id)
    try {
      setRequestingPickupOrderId(orderId)
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
    } finally {
      setRequestingPickupOrderId((current) => (current === orderId ? null : current))
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
      setDrawerOpen(true)
    })
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
  const formatCurrency = (value?: number | string | null) => `Rs ${Number(value ?? 0).toFixed(2)}`

  const getFinalCourierCharge = (row: B2COrder) => {
    const fallback =
      Number(row.freight_charges ?? 0) +
      Number(row.other_charges ?? 0) +
      ((row.order_type || '').toLowerCase() === 'cod' ? Number(row.cod_charges ?? 0) : 0)
    return Number(row.final_courier_charge ?? row.courier_charge ?? fallback)
  }

  const isDeliveryOneOrder = (row: B2COrder) => {
    const provider = `${row.integration_type || ''} ${row.courier_partner || ''}`
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
    return (
      provider.includes('deliveryone') ||
      provider.includes('delhiveryone')
    )
  }

  const isDelhiveryOrder = (row: B2COrder) => {
    const provider = `${row.integration_type || ''} ${row.courier_partner || ''}`.toLowerCase()
    return !isDeliveryOneOrder(row) && provider.includes('delhivery')
  }

  const isDeliveryOneTrackingOrder = (row: B2COrder) => {
    return (
      Boolean(String(row.awb_number || '').trim()) &&
      isDeliveryOneOrder(row)
    )
  }

  const isB2CPickupRequestEligible = (row: B2COrder) => {
    const status = String(row.order_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (!isDeliveryOneOrder(row) && !isDelhiveryOrder(row)) return false
    if (!String(row.awb_number || '').trim()) return false
    if (isB2CCancelledStatus(status)) return false
    return !['delivered', 'rto_delivered', 'returned'].includes(status)
  }

  const shouldShowManifestShipmentCount =
    pendingManifestRequest?.mode === 'single'
      ? isDelhiveryOrder(pendingManifestRequest.order)
      : selectedOrders.some(isDelhiveryOrder)

  const defaultManifestShipmentCount =
    pendingManifestRequest?.mode === 'single'
      ? 1
      : Math.max(1, selectedOrders.filter(isDelhiveryOrder).length || selectedOrders.length)

  const formatCompactDate = (value?: string | null) =>
    value ? moment(value).format('DD MMM, hh:mm A') : '-'

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

  const renderAwbLink = (value?: string | null) => {
    const awb = String(value || '').trim()
    if (!awb) return <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>No AWB</Typography>

    return (
      <Link
        component={RouterLink}
        to={`/tools/order_tracking?awb=${encodeURIComponent(awb)}`}
        underline="hover"
        onClick={(event) => event.stopPropagation()}
        sx={{ fontWeight: 800, fontSize: 12, lineHeight: 1.25 }}
      >
        {awb}
      </Link>
    )
  }

  const renderDocumentDownloadButton = (row: B2COrder, type: DocumentType) => {
    const meta = documentButtonMeta[type]
    const isAvailable = hasDocument(row, type)
    const rowDownloadKey = `${row.id}-${type}`
    const isDownloading = downloadingRowDocument === rowDownloadKey
    const isDisabled =
      !isAvailable || Boolean(downloadingDocumentType) || Boolean(downloadingRowDocument)

    return (
      <Tooltip
        key={type}
        title={
          isAvailable
            ? isDownloading
              ? `Downloading ${meta.label}...`
              : `Download ${meta.label}`
            : `${meta.label} not available`
        }
        arrow
      >
        <Box component="span" sx={{ display: 'inline-flex' }}>
          <IconButton
            size="small"
            aria-label={`Download ${meta.label}`}
            disabled={isDisabled}
            onClick={(event) => {
              event.stopPropagation()
              handleSingleDocumentDownload(row, type)
            }}
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              color: isAvailable ? '#0D3B8E' : 'text.disabled',
              border: `1px solid ${
                isAvailable
                  ? alpha(theme.palette.primary.main, 0.22)
                  : alpha(theme.palette.text.primary, 0.08)
              }`,
              backgroundColor: isAvailable
                ? alpha(theme.palette.primary.main, 0.06)
                : alpha(theme.palette.text.primary, 0.04),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
              },
              '& svg': {
                fontSize: 16,
              },
            }}
          >
            {isDownloading ? <CircularProgress size={14} /> : meta.icon}
          </IconButton>
        </Box>
      </Tooltip>
    )
  }

  const columns: Column<B2COrder>[] = [
    {
      label: 'Source',
      id: 'is_external_api',
      minWidth: 68,
      render: (_, row) => (
        <StatusChip
          label={row.is_external_api ? 'API' : 'Local'}
          status={row.is_external_api ? 'info' : 'success'}
        />
      ),
    },
    {
      label: 'Shipment',
      id: 'order_number',
      minWidth: 148,
      truncate: false,
      render: (_v, row) => (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.25 }} noWrap>
            {row.order_number || '-'}
          </Typography>
          {renderAwbLink(row.awb_number)}
        </Stack>
      ),
    },
    {
      label: 'Buyer',
      id: 'buyer_name',
      minWidth: 126,
      render: (value) => (
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, maxWidth: 130 }} noWrap>
          {String(value || '-')}
        </Typography>
      ),
    },
    {
      label: 'Amount',
      id: 'order_amount',
      minWidth: 110,
      truncate: false,
      render: (_v, row) => {
        const finalCharge = getFinalCourierCharge(row)
        return (
          <Stack spacing={0.2}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>
              {formatCurrency(row.order_amount)}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2 }}>
              Ship {formatCurrency(finalCharge)}
            </Typography>
          </Stack>
        )
      },
    },
    {
      label: 'Courier',
      id: 'courier_partner',
      minWidth: 132,
      truncate: false,
      render: (_v, row) => (
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, maxWidth: 140 }} noWrap>
          {getCourierDisplayName({
            name: row.courier_partner,
            courier_id: row.courier_id,
            integration_type: row.integration_type,
          }, '-')}
        </Typography>
      ),
    },
    {
      label: 'Status',
      id: 'order_status',
      minWidth: 128,
      truncate: false,
      render: (_v, row) => (
        <StatusChip
          label={shippingStatusMap[row.order_status] || row.order_status || 'Unknown'}
          status={statusColorMap[row.order_status] || 'info'}
        />
      ),
    },
    {
      label: 'Dates',
      id: 'created_at',
      minWidth: 122,
      truncate: false,
      render: (_v, row) => (
        <Stack spacing={0.2}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>
            {formatCompactDate(row.created_at)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2 }}>
            Upd {formatCompactDate(row.updated_at)}
          </Typography>
        </Stack>
      ),
    },
    {
      label: 'Actions',
      id: 'id',
      minWidth: 128,
      sticky: 'right',
      stickyOffset: 160,
      truncate: false,
      render: (_, row) => {
        const orderStatus = String(row.order_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
        const canSyncTracking = isDeliveryOneTrackingOrder(row)
        const isTrackingSyncing = syncingTrackingOrderId === String(row.id)
        const canRequestPickup = isB2CPickupRequestEligible(row)
        const isPickupRequesting =
          requestingPickupOrderId === String(row.id) || (requestingPickup && pickupScheduleOrder?.id === row.id)
        const rowManifestRef = getB2CManifestIdentifier(row)
        const canManifest = isB2CManifestEligible(row)
        const isThisManifesting = Boolean(rowManifestRef && manifestingRef === rowManifestRef)
        const retriesRemaining = Number(row.manifest_retries_remaining ?? 0)
        const isDelhiveryIntegration = ['delhivery', 'deliveryone'].includes(
          String(row.integration_type || '').toLowerCase(),
        )
        const canRetryManifest =
          row.can_retry_manifest === true &&
          isDelhiveryIntegration
        const canTrackShipment = Boolean(String(row.awb_number || '').trim())
        const isCancelled = isB2CCancelledStatus(orderStatus)
        const isDocumentReady = isDocumentGenerationReady(row)
        const isLabelGenerating = documentGenerationRef === `${row.id}-label`
        const isInvoiceGenerating = documentGenerationRef === `${row.id}-invoice`
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
              primaryTypographyProps={{ fontSize: 13, fontWeight: 700 }}
            />
          </MenuItem>
        )

        return (
          <>
            <Button
              size="small"
              variant={isMenuOpen ? 'contained' : 'outlined'}
              endIcon={<MdMoreVert size={16} />}
              onClick={(event) => handleActionMenuOpen(event, row.id)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen ? 'true' : undefined}
              sx={{
                minHeight: 32,
                px: 1.15,
                borderRadius: '8px',
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                boxShadow: isMenuOpen ? '0 10px 20px rgba(51, 51, 105, 0.14)' : 'none',
              }}
            >
              Actions
            </Button>
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
                    minWidth: 260,
                    borderRadius: '10px',
                    border: '1px solid rgba(51, 51, 105, 0.12)',
                    background: 'rgba(255, 255, 255, 0.98)',
                    boxShadow: '0 18px 38px rgba(51, 51, 105, 0.16)',
                    overflow: 'hidden',
                  },
                },
                list: {
                  dense: true,
                  sx: { py: 0.45 },
                },
              }}
            >
              {renderActionItem({
                key: 'view-details',
                icon: <MdVisibility />,
                label: 'View Details',
                onClick: () => handleViewDetails(row),
              })}
              <Divider sx={{ my: 0.35 }} />
              {renderActionItem({
                key: 'generate-manifest',
                icon: <MdAssignment />,
                label: isThisManifesting ? 'Generating Manifest' : 'Generate Manifest',
                onClick: () => openSingleManifestSchedule(row),
                disabled: isCancelled || !canManifest || bulkManifesting,
                loading: isThisManifesting,
              })}
              {renderActionItem({
                key: 'generate-label',
                icon: <MdLocalOffer />,
                label: isLabelGenerating
                  ? 'Generating Label'
                  : hasDocument(row, 'label')
                    ? 'Regenerate Label'
                    : 'Generate Label',
                onClick: () => handleGenerateOrderDocument(row, 'label'),
                disabled:
                  isCancelled ||
                  !isDocumentReady ||
                  regeneratingDocuments ||
                  Boolean(documentGenerationRef),
                loading: isLabelGenerating,
              })}
              {renderActionItem({
                key: 'generate-invoice',
                icon: <MdReceipt />,
                label: isInvoiceGenerating
                  ? 'Generating Invoice'
                  : hasDocument(row, 'invoice')
                    ? 'Regenerate Invoice'
                    : 'Generate Invoice',
                onClick: () => handleGenerateOrderDocument(row, 'invoice'),
                disabled:
                  isCancelled ||
                  !isDocumentReady ||
                  regeneratingDocuments ||
                  Boolean(documentGenerationRef),
                loading: isInvoiceGenerating,
              })}
              {(canRequestPickup ||
                (orderStatus === 'manifest_failed' && canRetryManifest) ||
                orderStatus === 'delivered' ||
                isB2CCancelEligible(row)) && <Divider sx={{ my: 0.35 }} />}
              {canRequestPickup &&
                renderActionItem({
                  key: 'request-pickup',
                  icon: <MdEventAvailable />,
                  label: isPickupRequesting ? 'Scheduling Pickup' : 'Request Pickup',
                  onClick: () => setPickupScheduleOrder(row),
                  disabled: isPickupRequesting,
                })}
              {orderStatus === 'manifest_failed' &&
                canRetryManifest &&
                renderActionItem({
                  key: 'retry-manifest',
                  icon: <MdReplay />,
                  label: retryingManifest ? 'Retrying Manifest' : `Retry Manifest (${retriesRemaining} left)`,
                  onClick: () => handleRetryManifest(row),
                  disabled: retryingManifest,
                })}
              {orderStatus === 'delivered' &&
                renderActionItem({
                  key: 'reverse',
                  icon: <MdKeyboardReturn />,
                  label: 'Create Reverse',
                  onClick: () => setReverseOrder(row),
                })}
              {isB2CCancelEligible(row) &&
                renderActionItem({
                  key: 'cancel',
                  icon: <MdCancel />,
                  label: cancellingShipment ? 'Cancelling Shipment' : 'Cancel Shipment',
                  onClick: () => cancelShipment(String(row.id)),
                  disabled: cancellingShipment,
                  danger: true,
                })}
              <Divider sx={{ my: 0.35 }} />
              {renderActionItem({
                key: 'track-shipment',
                icon: <MdLocalShipping />,
                label: 'Track Shipment',
                onClick: () => handleTrackShipment(row),
                disabled: !canTrackShipment,
              })}
              {renderActionItem({
                key: 'sync-live-status',
                icon: <MdSync />,
                label: isTrackingSyncing ? 'Syncing Live Status' : 'Sync Live Status',
                onClick: () => handleSyncTracking(row),
                disabled: !canSyncTracking,
                loading: isTrackingSyncing,
              })}
            </Menu>
          </>
        )
      },
    },
    {
      label: 'PDFs',
      id: 'manifest',
      minWidth: 116,
      sticky: 'right',
      stickyOffset: 44,
      truncate: false,
      render: (_v, row) => (
        <Stack direction="row" spacing={0.35}>
          {renderDocumentDownloadButton(row, 'label')}
          {renderDocumentDownloadButton(row, 'invoice')}
          {renderDocumentDownloadButton(row, 'manifest')}
        </Stack>
      ),
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
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateB2COrder}
          sx={{ minHeight: 36, px: 1.6, textTransform: 'none', fontWeight: 700 }}
        >
          Create B2C Order
        </Button>
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
              <Typography sx={{ fontWeight: 700, color: '#333369', fontSize: '14px' }}>
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
          expandable
          renderExpandedRow={(row) => <OrderExpandedRow row={row} />}
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
            : 'Schedule Manifest Pickup'
        }
        description="Choose the pickup date and time before sending this manifest to the courier."
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
        onClose={() => setDrawerOpen(false)}
        title="Create New B2C Order"
      >
        <B2COrderFormSteps onClose={() => setDrawerOpen(false)} />
      </CustomDrawer>
    </Stack>
  )
}

export default B2COrdersList
