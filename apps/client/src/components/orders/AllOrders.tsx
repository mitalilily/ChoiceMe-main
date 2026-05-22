import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertTitle,
  alpha,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useState, type ReactNode } from 'react'
import { MdAssignment, MdLocalOffer, MdReceipt } from 'react-icons/md'
import { TbFilter, TbPlus, TbRefresh } from 'react-icons/tb'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { generateManifestService } from '../../api/order.service'
import { useAllOrders, useB2BOrdersByUser, useB2COrdersByUser } from '../../hooks/Orders/useOrders'
import { usePresignedDownloadMutation } from '../../hooks/Uploads/usePresignedDownloadUrls'
import { FilterBar, type FilterField } from '../FilterBar'
import { toast } from '../UI/Toast'
import StatusChip from '../UI/chip/StatusChip'
import DataTable, { type Column } from '../UI/table/DataTable'
import TableSkeleton from '../UI/table/TableSkeleton'
import { statusColorMap } from './b2c/B2COrdersList'
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
  summarizeMessages,
  summarizeOrderNumbers,
} from './bulkActionUtils'
import ManifestScheduleDialog, {
  type ManifestSchedulePayload,
} from './ManifestScheduleDialog'
import { OrderExpandedRow } from './OrderExpandedRow'

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

const documentButtonMeta: Record<DocumentType, { label: string; icon: ReactNode }> = {
  label: { label: 'Label', icon: <MdLocalOffer /> },
  invoice: { label: 'Invoice', icon: <MdReceipt /> },
  manifest: { label: 'Manifest', icon: <MdAssignment /> },
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
  const [manifestScheduleOpen, setManifestScheduleOpen] = useState(false)
  const [bulkFeedback, setBulkFeedback] = useState<BulkFeedback | null>(null)
  const [filters, setFilters] = useState<OrdersFilters>({
    status: undefined,
    fromDate: undefined,
    toDate: undefined,
    search: undefined,
  })
  const queryClient = useQueryClient()
  const { mutateAsync: presignDownloads } = usePresignedDownloadMutation()
  const isB2CView = location.pathname.startsWith('/orders/b2c')
  const isB2BView = location.pathname.startsWith('/orders/b2b')
  const currentOrderView: 'all' | 'b2c' | 'b2b' = isB2CView ? 'b2c' : isB2BView ? 'b2b' : 'all'

  const clearSelection = () => {
    setSelectedOrderIds([])
    setSelectionResetToken((current) => current + 1)
  }

  useEffect(() => {
    setManifestScheduleOpen(false)
    setBulkFeedback(null)
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
  const manifestValidationMessage =
    selectedOrders.length === 0
      ? 'Select orders to start a bulk action.'
      : selectedOrders.length > BULK_MANIFEST_LIMIT
        ? `You can manifest a maximum of ${BULK_MANIFEST_LIMIT} orders at a time.`
        : selectedOrders.some((order) => !isManifestEligible(order))
          ? 'Some selected orders are not ready for manifest yet.'
          : ''

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

  const formatCurrency = (value?: number | string | null) => `Rs ${Number(value ?? 0).toFixed(2)}`

  const hasDocument = (order: Order, type: DocumentType) => {
    const { key, url } = getDocumentReference(order, type)
    return Boolean(key || url)
  }

  const renderDocumentDownloadButton = (order: Order, type: DocumentType) => {
    const meta = documentButtonMeta[type]
    const isAvailable = hasDocument(order, type)
    const rowDownloadKey = `${order.id}-${type}`
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
              handleSingleDocumentDownload(order, type)
            }}
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              color: isAvailable ? '#0D3B8E' : 'text.disabled',
              border: `1px solid ${
                isAvailable ? alpha('#0D3B8E', 0.22) : alpha('#1D2842', 0.08)
              }`,
              backgroundColor: isAvailable ? alpha('#0D3B8E', 0.06) : alpha('#1D2842', 0.04),
              '&:hover': {
                backgroundColor: alpha('#0D3B8E', 0.12),
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

  const columns: Column<Order>[] = [
    {
      id: 'order_number',
      label: 'Shipment',
      minWidth: 150,
      truncate: false,
      render: (_v, row) => (
        <Stack spacing={0.25}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.25 }} noWrap>
            {row.order_number || '-'}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase' }}>
            {row.type || 'order'}
          </Typography>
        </Stack>
      ),
    },
    {
      id: 'buyer_name',
      label: 'Buyer / Location',
      minWidth: 150,
      truncate: false,
      render: (_v, row) => (
        <Stack spacing={0.25}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, maxWidth: 150 }} noWrap>
            {row.buyer_name || '-'}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', maxWidth: 150 }} noWrap>
            {[row.city, row.state].filter(Boolean).join(', ') || '-'}
          </Typography>
        </Stack>
      ),
    },
    {
      id: 'order_amount',
      label: 'Amount',
      minWidth: 105,
      render: (value) => (
        <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>
          {formatCurrency(value)}
        </Typography>
      ),
    },
    {
      label: 'Status',
      id: 'order_status',
      minWidth: 142,
      sticky: 'right',
      stickyOffset: 116,
      render: (v) => <StatusChip label={v} status={statusColorMap[v] || 'info'} />,
    },
    {
      label: 'PDFs',
      id: 'manifest',
      minWidth: 116,
      sticky: 'right',
      stickyOffset: 0,
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
            expandable
            renderExpandedRow={(row) => <OrderExpandedRow row={row} />}
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
    </Stack>
  )
}

export default AllOrders
