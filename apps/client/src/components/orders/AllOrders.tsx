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
} from '@mui/material'
import moment from 'moment'
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import {
  MdAssignment,
  MdDelete,
  MdFileDownload,
  MdEdit,
  MdLocalOffer,
  MdMoreHoriz,
  MdReceipt,
  MdSync,
  MdTrackChanges,
  MdVisibility,
} from 'react-icons/md'
import { TbDownload, TbFilter, TbPlus, TbRefresh } from 'react-icons/tb'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchOrdersForCsvExport,
  generateManifestService,
  regenerateOrderDocumentsService,
} from '../../api/order.service'
import {
  useAllOrders,
  useB2BOrdersByUser,
  useB2COrdersByUser,
  useCancelShipment,
  useDeleteB2COrder,
  useRegenerateOrderDocuments,
  useSyncB2CTracking,
} from '../../hooks/Orders/useOrders'
import { usePresignedDownloadMutation } from '../../hooks/Uploads/usePresignedDownloadUrls'
import { useLabelPreferences } from '../../hooks/useLabelPreferences'
import { downloadClientOrdersCsv } from '../../utils/orderCsvExport'
import { FilterBar, type FilterField } from '../FilterBar'
import { toast } from '../UI/Toast'
import CustomDrawer from '../UI/drawer/CustomDrawer'
import DataTable, { type Column } from '../UI/table/DataTable'
import TableSkeleton from '../UI/table/TableSkeleton'
import { statusColorMap } from './b2c/B2COrdersList'
import B2COrderFormSteps, { type B2CFormData } from './b2c/B2COrderForm'
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
  isB2CCancelledStatus,
  isB2CManifestEligible,
  summarizeMessages,
  summarizeOrderNumbers,
} from './bulkActionUtils'
import ManifestScheduleDialog, {
  type ManifestSchedulePayload,
} from './ManifestScheduleDialog'
import OrderDetailsDialog from './OrderDetailsDialog'
import B2CSelectCourierDialog from './b2c/B2CSelectCourierDialog'
import { isB2CCancelEligible, isB2CPreShipmentDraft } from './b2c/orderActionRules'
import { getB2COrderFormDefaults } from './b2c/orderFormDefaults'

interface Order {
  id: string | number
  type?: 'b2c' | 'b2b'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type OrdersFilters = {
  status?: string
  fromDate?: string
  toDate?: string
  search?: string
}

type BulkFeedback = {
  severity: 'info' | 'success' | 'error' | 'warning'
  title: string
  message: string
}

const toMoneyNumber = (value: unknown) => {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

const getCustomerPaymentTotal = (order: Order) => {
  const orderType = String(order.type || '').toLowerCase()
  if (orderType && orderType !== 'b2c') {
    return toMoneyNumber(order.order_amount)
  }

  return Math.max(
    0,
    toMoneyNumber(order.order_amount) +
      toMoneyNumber(order.shipping_charges) +
      toMoneyNumber(order.transaction_fee) +
      toMoneyNumber(order.gift_wrap) -
      toMoneyNumber(order.discount) -
      toMoneyNumber(order.prepaid_amount),
  )
}

const documentButtonMeta: Record<DocumentType, { label: string; icon: ReactNode }> = {
  label: { label: 'Label', icon: <MdLocalOffer /> },
  invoice: { label: 'Invoice', icon: <MdReceipt /> },
  manifest: { label: 'Manifest', icon: <MdAssignment /> },
}

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

const shippingStatusMap: Record<string, string> = {
  pending: 'NEW',
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

const isManifestEligible = (order: Order) => {
  return order.type === 'b2c' ? isB2CManifestEligible(order) : false
}

const AllOrders = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Array<Order['id']>>([])
  const [selectionResetToken, setSelectionResetToken] = useState(0)
  const [downloadingDocumentType, setDownloadingDocumentType] = useState<DocumentType | null>(
    null,
  )
  const [downloadingRowDocument, setDownloadingRowDocument] = useState<string | null>(null)
  const [bulkManifesting, setBulkManifesting] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [manifestScheduleOpen, setManifestScheduleOpen] = useState(false)
  const [selectCourierOrder, setSelectCourierOrder] = useState<Order | null>(null)
  const [orderDetailsOrder, setOrderDetailsOrder] = useState<Order | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [orderFormDefaults, setOrderFormDefaults] = useState<Partial<B2CFormData> | null>(null)
  const [orderFormKey, setOrderFormKey] = useState(0)
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null)
  const [activeActionOrderId, setActiveActionOrderId] = useState<Order['id'] | null>(null)
  const [documentGenerationRef, setDocumentGenerationRef] = useState<string | null>(null)
  const [syncingTrackingOrderId, setSyncingTrackingOrderId] = useState<Order['id'] | null>(null)
  const [bulkFeedback, setBulkFeedback] = useState<BulkFeedback | null>(null)
  const [filters, setFilters] = useState<OrdersFilters>({
    status: undefined,
    fromDate: undefined,
    toDate: undefined,
    search: undefined,
  })
  const queryClient = useQueryClient()
  const { preferences: labelPreferences } = useLabelPreferences()
  const { mutateAsync: presignDownloads } = usePresignedDownloadMutation()
  const { mutateAsync: regenerateDocuments, isPending: regeneratingDocuments } =
    useRegenerateOrderDocuments()
  const { mutate: cancelShipment, isPending: cancellingShipment } = useCancelShipment()
  const { mutateAsync: deleteB2COrder, isPending: deletingB2COrder } = useDeleteB2COrder()
  const { mutate: syncB2CTracking, isPending: syncingTracking } = useSyncB2CTracking()
  const isB2CView = location.pathname.startsWith('/orders/b2c')
  const isB2BView = location.pathname.startsWith('/orders/b2b')
  const currentOrderView: 'all' | 'b2c' | 'b2b' = isB2CView ? 'b2c' : isB2BView ? 'b2b' : 'all'

  const clearSelection = () => {
    setSelectedOrderIds([])
    setSelectionResetToken((current) => current + 1)
  }

  const handleActionMenuOpen = (
    event: MouseEvent<HTMLElement>,
    orderId: Order['id'],
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

  useEffect(() => {
    setManifestScheduleOpen(false)
    setBulkFeedback(null)
    setSelectCourierOrder(null)
    setOrderDetailsOrder(null)
    setEditingOrder(null)
    setOrderFormDefaults(null)
    setActionMenuAnchor(null)
    setActiveActionOrderId(null)
    setDocumentGenerationRef(null)
    setSyncingTrackingOrderId(null)
    setSelectedOrderIds([])
    setSelectionResetToken((current) => current + 1)
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    const status = searchParams.get('status') || undefined
    if (status && filters.status !== status) {
      setFilters((prev) => ({
        ...prev,
        status,
      }))
      setPage(1)
      clearSelection()
      setBulkFeedback(null)
    }
  }, [searchParams, filters.status])

  const allOrdersQuery = useAllOrders(
    {
      page,
      limit: rowsPerPage,
      ...filters,
    },
    currentOrderView === 'all',
  )

  const b2cOrdersQuery = useB2COrdersByUser(page, rowsPerPage, filters, currentOrderView === 'b2c')
  const b2bOrdersQuery = useB2BOrdersByUser(page, rowsPerPage, filters, currentOrderView === 'b2b')

  const activeQuery =
    currentOrderView === 'b2c'
      ? b2cOrdersQuery
      : currentOrderView === 'b2b'
        ? b2bOrdersQuery
        : allOrdersQuery

  if (activeQuery.isError)
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          px: 3,
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Typography
          color="error"
          textAlign="center"
          fontSize="16px"
          fontWeight={600}
          sx={{ color: '#E74C3C' }}
        >
          Failed to fetch orders
        </Typography>
        <Typography textAlign="center" fontSize="14px" sx={{ color: '#6B7280', mt: 1 }}>
          Please try refreshing the page
        </Typography>
      </Box>
    )

  const normalizedOrders: Order[] = (activeQuery.data?.orders ?? []).map((order: Order) => ({
    ...order,
    type: order.type || (currentOrderView === 'b2c' ? 'b2c' : currentOrderView === 'b2b' ? 'b2b' : order.type),
  }))
  const orders: Order[] = normalizedOrders
  const totalCount = activeQuery.data?.totalCount ?? 0
  const selectedOrders: Order[] = orders.filter((order) => selectedOrderIds.includes(order.id))
  const bulkLabelPdfLayout =
    labelPreferences?.printer_type === 'inkjet' && labelPreferences?.label_sheet_layout === 'a4_4up'
      ? 'a4_4up'
      : 'single'
  const manifestValidationMessage =
    selectedOrders.length === 0
      ? 'Select orders to start a bulk action.'
      : selectedOrders.length > BULK_MANIFEST_LIMIT
        ? `You can manifest a maximum of ${BULK_MANIFEST_LIMIT} orders at a time.`
        : selectedOrders.some((order) => !isManifestEligible(order))
          ? 'Some selected orders are not ready for manifest yet.'
          : ''

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true)
      const exportRows = await fetchOrdersForCsvExport(currentOrderView, filters)
      downloadClientOrdersCsv(exportRows, currentOrderView)
      toast.open({
        message: `${exportRows.length} order${exportRows.length === 1 ? '' : 's'} exported to CSV.`,
        severity: 'success',
      })
    } catch (error) {
      console.error('Order CSV export failed:', error)
      toast.open({ message: 'Failed to export orders CSV. Please try again.', severity: 'error' })
    } finally {
      setExportingCsv(false)
    }
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

    setManifestScheduleOpen(true)
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
      const b2cManifestGroups = selectedOrders.reduce<Record<string, Order[]>>((groups, order) => {
        if (order.type !== 'b2c') return groups

        const manifestIdentifier = getB2CManifestIdentifier(order)
        if (!manifestIdentifier) return groups

        const providerKey = getB2CManifestProvider(order)
        if (!groups[providerKey]) groups[providerKey] = []
        groups[providerKey].push(order)
        return groups
      }, {})

      const failedOrders: Order[] = []
      const failureReasons: string[] = []
      const warningMessages: string[] = []
      let successCount = 0

      for (const [providerKey, providerOrders] of Object.entries(b2cManifestGroups)) {
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

  const handleManifestScheduleConfirm = async (schedule: ManifestSchedulePayload) => {
    await handleBulkManifest(schedule)
    setManifestScheduleOpen(false)
  }

  const selectedDelhiveryOrders = selectedOrders.filter(
    (order) => order.type === 'b2c' && getB2CManifestProvider(order) === 'deliveryone',
  )
  const showManifestShipmentCount = selectedDelhiveryOrders.length > 0
  const defaultManifestShipmentCount = Math.max(
    1,
    selectedDelhiveryOrders.length || selectedOrders.length,
  )

  const getDocumentEntriesForOrders = (targetOrders: Order[], type: DocumentType) =>
    targetOrders.reduce<DocumentEntry[]>((entries, order) => {
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

  const handleSingleDocumentDownload = async (order: Order, type: DocumentType) => {
    const typeLabel = documentButtonMeta[type].label
    const rowDownloadKey = `${order.id}-${type}`

    try {
      setDownloadingRowDocument(rowDownloadKey)
      const documentEntries = getDocumentEntriesForOrders([order], type)

      if (!documentEntries.length) {
        toast.open({
          message: `${typeLabel} is not available for ${order.order_number || 'this order'} yet.`,
          severity: 'error',
        })
        return
      }

      const { downloadedCount } = await downloadDocumentEntries(documentEntries)

      if (!downloadedCount) {
        toast.open({
          message: `${typeLabel} could not be downloaded for ${order.order_number || 'this order'}.`,
          severity: 'error',
        })
        return
      }

      toast.open({
        message: `${typeLabel} downloaded for ${order.order_number || 'this order'}.`,
        severity: 'success',
      })
    } catch (error) {
      console.error(`${typeLabel} download failed:`, error)
      const message = getActionableErrorMessage(
        error,
        `Failed to download ${typeLabel.toLowerCase()} for ${order.order_number || 'this order'}. Please try again.`,
      )
      toast.open({ message, severity: 'error' })
    } finally {
      setDownloadingRowDocument(null)
    }
  }

  const formatCurrency = (value?: number | string | null, decimals = 0) =>
    `Rs ${Number(value ?? 0).toFixed(decimals)}`

  const hasDocument = (order: Order, type: DocumentType) => {
    const { key, url } = getDocumentReference(order, type)
    return Boolean(key || url)
  }

  const isCourierSelectionPending = (order: Order) => {
    return order.type === 'b2c' && isB2CPreShipmentDraft(order)
  }

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

  const getOrderProducts = (row: Order): Array<Record<string, unknown>> => {
    const rawProducts: unknown = row.products
    if (Array.isArray(rawProducts)) return rawProducts as Array<Record<string, unknown>>
    if (typeof rawProducts === 'string') {
      try {
        const parsedProducts: unknown = JSON.parse(rawProducts)
        return Array.isArray(parsedProducts) ? (parsedProducts as Array<Record<string, unknown>>) : []
      } catch {
        return []
      }
    }
    return []
  }

  const getProductName = (row: Order) => {
    const products = getOrderProducts(row)
    const firstProduct = products[0]
    const rawName = String(firstProduct?.productName ?? firstProduct?.name ?? firstProduct?.box_name ?? '').trim()
    if (!rawName) return '-'
    return products.length > 1 ? `${rawName} +${products.length - 1}` : rawName
  }

  const getProductQuantity = (row: Order) => {
    const products = getOrderProducts(row)
    const quantity = products.reduce((sum, product) => {
      const productQuantity = Number(product.quantity ?? product.qty ?? 0)
      return sum + (Number.isFinite(productQuantity) ? productQuantity : 0)
    }, 0)
    return Math.max(quantity, 1)
  }

  const getPickupAddressName = (row: Order) =>
    String(row.pickup_details?.warehouse_name || row.pickup_details?.name || '-').trim() || '-'

  const getDisplayStatusLabel = (status?: string | null) => {
    const normalizedStatus = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    return shippingStatusMap[normalizedStatus] || status || 'Unknown'
  }

  const isDocumentGenerationReady = (row: Order) => {
    const normalizedStatus = String(row.order_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    return (
      Boolean(String(row.manifest_key || row.manifest || row.awb_number || '').trim()) ||
      documentGenerationStatuses.has(normalizedStatus)
    )
  }

  const openSingleManifestSchedule = (order: Order) => {
    if (!isManifestEligible(order)) {
      toast.open({ message: 'Generate manifest is not available for this order yet.', severity: 'info' })
      return
    }

    setSelectedOrderIds([order.id])
    setBulkFeedback(null)
    setManifestScheduleOpen(true)
  }

  const handleGenerateOrderDocument = async (order: Order, type: 'label' | 'invoice') => {
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
      console.error(`Failed to regenerate ${type} for order:`, order.order_number, error)
    } finally {
      setDocumentGenerationRef((current) => (current === documentRef ? null : current))
    }
  }

  const handleTrackShipment = (order: Order) => {
    const awb = String(order.awb_number || '').trim()
    if (!awb) {
      toast.open({ message: 'AWB is not available for tracking yet.', severity: 'info' })
      return
    }

    navigate(`/tools/order_tracking?awb=${encodeURIComponent(awb)}`)
  }

  const handleSyncLiveStatus = (order: Order) => {
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

  const handleEditB2COrder = (order: Order) => {
    if (order.type !== 'b2c' || !isB2CPreShipmentDraft(order)) {
      toast.open({
        message: 'Only draft B2C orders that have not been shipped yet can be edited.',
        severity: 'warning',
      })
      return
    }

    setEditingOrder(order)
    setOrderFormDefaults(getB2COrderFormDefaults(order as any))
    setOrderFormKey((current) => current + 1)
  }

  const handleDeleteB2COrder = async (order: Order) => {
    if (order.type !== 'b2c' || !isB2CPreShipmentDraft(order)) {
      toast.open({
        message: 'Only draft B2C orders that have not been shipped yet can be deleted.',
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

  const columns: Column<Order>[] = [
    {
      id: 'order_number',
      label: 'Order Details',
      minWidth: 142,
      truncate: false,
      render: (_v, row) => (
        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
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
              color: '#05BD7E',
              fontSize: 12.2,
              fontWeight: 600,
              lineHeight: 1.25,
              '&:hover': { textDecoration: 'underline' },
              '&:focus-visible': {
                outline: '2px solid rgba(5, 189, 126, 0.35)',
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
      id: 'buyer_name',
      label: 'Customer Details',
      minWidth: 176,
      truncate: false,
      render: (_v, row) => (
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
        const paymentTotal = getCustomerPaymentTotal(row)
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
                color: isCod ? 'warning.dark' : '#038B60',
                bgcolor: isCod ? alpha('#FF9C4B', 0.12) : alpha('#05BD7E', 0.12),
                border: `1px solid ${isCod ? alpha('#B45309', 0.24) : alpha('#05BD7E', 0.45)}`,
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
            borderBottom: `1px dashed ${alpha('#0D1B4D', 0.28)}`,
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
            color: '#05BD7E',
            bgcolor: alpha('#05BD7E', 0.08),
            border: `1px solid ${alpha('#05BD7E', 0.45)}`,
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
      render: (_v, row) => {
        const orderStatus = String(row.order_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
        const canManifest = isManifestEligible(row)
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
        const canEditDraft = row.type === 'b2c' && isB2CPreShipmentDraft(row)
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
                    border: `1px solid ${alpha('#0D1B4D', 0.12)}`,
                    background: '#FFFFFF',
                    boxShadow: `0 18px 38px ${alpha('#0D1B4D', 0.18)}`,
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
                label: bulkManifesting ? 'Generating Manifest' : 'Generate Manifest',
                onClick: () => openSingleManifestSchedule(row),
                disabled: !canManifest || bulkManifesting,
                loading: canManifest && bulkManifesting,
              })}
              {renderActionItem({
                key: 'regenerate-label',
                icon: <MdLocalOffer />,
                label: isLabelGenerating ? 'Regenerating Label' : 'Regenerate Label',
                onClick: () => handleGenerateOrderDocument(row, 'label'),
                disabled:
                  row.type !== 'b2c' ||
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
                  row.type !== 'b2c' ||
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
                disabled: row.type !== 'b2c' || !isB2CCancelEligible(row) || cancellingShipment,
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
                disabled: row.type !== 'b2c' || !hasAwb || syncingTracking,
                loading: isSyncingThisOrder,
              })}
            </Menu>
          </Stack>
        )
      },
    },
  ]

  const filterFields: FilterField[] = [
    {
      name: 'search',
      label: 'Search',
      type: 'text',
      placeholder: 'Order # / Buyer Name',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: Object.keys(statusColorMap).map((status) => ({
        label: status,
        value: status,
      })),
      isAdvanced: true,
    },
    { name: 'fromDate', label: 'From Date', type: 'date', placeholder: 'YYYY-MM-DD' },
    { name: 'toDate', label: 'To Date', type: 'date', placeholder: 'YYYY-MM-DD' },
  ]

  return (
    <Stack gap={1.2}>
      <Box
        sx={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid rgba(29, 40, 66, 0.1)',
          boxShadow: '0 6px 18px rgba(29, 40, 66, 0.06)',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          justifyContent="space-between"
          gap={1}
          sx={{
            px: { xs: 1.15, md: 1.5 },
            py: 1,
            borderBottom: '1px solid rgba(29, 40, 66, 0.08)',
            bgcolor: '#ffffff',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: '#1D2842',
              fontSize: '17px',
            }}
          >
            Orders Management
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<TbRefresh size={16} />}
              onClick={() => activeQuery.refetch()}
              disabled={activeQuery.isRefetching}
              sx={{ borderRadius: 1, minHeight: 34, fontSize: 12 }}
            >
              {activeQuery.isRefetching ? 'Refreshing' : 'Refresh'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<TbFilter size={16} />}
              onClick={() =>
                document.getElementById('orders-filter-bar')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
              sx={{ borderRadius: 1, minHeight: 34, fontSize: 12 }}
            >
              Filters
            </Button>
            <Button
              variant="outlined"
              startIcon={exportingCsv ? <CircularProgress size={14} /> : <TbDownload size={16} />}
              onClick={handleExportCsv}
              disabled={exportingCsv}
              sx={{ borderRadius: 1, minHeight: 34, fontSize: 12 }}
            >
              {exportingCsv ? 'Exporting' : 'Export CSV'}
            </Button>
            <Button
              variant="contained"
              startIcon={<TbPlus size={16} />}
              onClick={() => navigate('/orders/create')}
              sx={{
                borderRadius: 1,
                minHeight: 34,
                fontSize: 12,
                bgcolor: '#1D2842',
                '&:hover': {
                  bgcolor: '#152038',
                },
              }}
            >
              Create Order
            </Button>
          </Stack>
        </Stack>

        <Box sx={{ px: { xs: 1.15, md: 1.5 }, pt: 1 }} id="orders-filter-bar">
          <FilterBar
            fields={filterFields}
            defaultValues={filters}
            onApply={(appliedFilters) => {
              setFilters(appliedFilters)
              setPage(1)
              clearSelection()
              setBulkFeedback(null)
            }}
            compact
          />
        </Box>

        {bulkFeedback && (
          <Alert
            severity={bulkFeedback.severity}
            onClose={() => setBulkFeedback(null)}
            sx={{ mt: 1, mx: { xs: 1.15, md: 1.5 }, alignItems: 'flex-start' }}
          >
            <AlertTitle>{bulkFeedback.title}</AlertTitle>
            {bulkFeedback.message}
          </Alert>
        )}

        {selectedOrders.length > 0 && (
          <Box
            sx={{
              mt: 1,
              mx: { xs: 1.15, md: 1.5 },
              p: 1.25,
              borderRadius: '8px',
              border: '1px solid rgba(29, 40, 66, 0.14)',
              backgroundColor: 'rgba(29, 40, 66, 0.04)',
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
      </Box>

      <Box
        sx={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid rgba(29, 40, 66, 0.1)',
          boxShadow: '0 6px 18px rgba(29, 40, 66, 0.06)',
          overflow: 'hidden',
        }}
      >
        {activeQuery.isLoading ? (
          <Box sx={{ p: 1.5 }}>
            <TableSkeleton />
          </Box>
        ) : (
          <DataTable<Order>
            rows={orders}
            columns={columns}
            title={
              currentOrderView === 'b2c'
                ? `${totalCount} total B2C orders`
                : currentOrderView === 'b2b'
                  ? `${totalCount} total B2B orders`
                  : `${totalCount} total orders`
            }
            pagination
            selectable
            density="compact"
            tableVariant="shipment"
            maxHeight={640}
            currentPage={page}
            onPageChange={(newPage) => {
              setPage(newPage + 1)
              clearSelection()
              setBulkFeedback(null)
            }}
            onRowsPerPageChange={(newRowsPerPage) => {
              setRowsPerPage(newRowsPerPage)
              setPage(1)
              clearSelection()
              setBulkFeedback(null)
            }}
            defaultRowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            totalCount={totalCount}
            onSelectRows={(ids) => setSelectedOrderIds(ids as Array<Order['id']>)}
            selectedRowIds={selectedOrderIds}
            selectionResetToken={selectionResetToken}
          />
        )}
      </Box>

      <ManifestScheduleDialog
        open={manifestScheduleOpen}
        loading={bulkManifesting}
        defaultShipmentCount={defaultManifestShipmentCount}
        showShipmentCount={showManifestShipmentCount}
        title="Schedule Selected Manifests"
        description="Choose the pickup date and time before sending the selected manifests to the courier."
        onClose={() => {
          if (!bulkManifesting) setManifestScheduleOpen(false)
        }}
        onConfirm={handleManifestScheduleConfirm}
      />

      <B2CSelectCourierDialog
        open={Boolean(selectCourierOrder)}
        order={selectCourierOrder as any}
        onClose={() => setSelectCourierOrder(null)}
      />

      <OrderDetailsDialog
        open={Boolean(orderDetailsOrder)}
        order={orderDetailsOrder}
        onClose={() => setOrderDetailsOrder(null)}
      />

      <CustomDrawer
        width={1200}
        open={Boolean(editingOrder)}
        onClose={() => {
          setEditingOrder(null)
          setOrderFormDefaults(null)
          setOrderFormKey((current) => current + 1)
        }}
        title={editingOrder?.order_number ? `Edit Order ${editingOrder.order_number}` : 'Edit Order'}
      >
        {editingOrder && (
          <B2COrderFormSteps
            key={orderFormKey}
            initialValues={orderFormDefaults || undefined}
            mode="edit"
            existingOrderId={String(editingOrder.id)}
            onClose={() => {
              setEditingOrder(null)
              setOrderFormDefaults(null)
              setOrderFormKey((current) => current + 1)
            }}
          />
        )}
      </CustomDrawer>
    </Stack>
  )
}

export default AllOrders
