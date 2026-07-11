import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { BiCopy, BiLink, BiRefresh } from 'react-icons/bi'
import { MdCheck, MdClose, MdShoppingCart } from 'react-icons/md'
import type { CreateShipmentParams } from '../../api/order.service'
import type { QuickDetail, QuickDetailStatus } from '../../api/quickDetails.api'
import B2COrderFormSteps, { type B2CFormData } from '../../components/orders/b2c/B2COrderForm'
import CustomDrawer from '../../components/UI/drawer/CustomDrawer'
import { toast } from '../../components/UI/Toast'
import DataTable, { type Column } from '../../components/UI/table/DataTable'
import {
  useApproveQuickDetail,
  useGenerateQuickDetailLink,
  useQuickDetails,
  useRejectQuickDetail,
} from '../../hooks/useQuickDetails'
import { brand } from '../../theme/brand'

const PAGE_SIZE = 20

const getLocalDateInputValue = () => {
  const today = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
}

const getPublicUrl = (row?: Pick<QuickDetail, 'publicPath' | 'publicUrl'> | null) => {
  if (!row) return ''
  if (row.publicUrl) return row.publicUrl
  return `${window.location.origin}${row.publicPath}`
}

const buildInitialValues = (row: QuickDetail | null): Partial<B2CFormData> => {
  const customer = row?.customerDetails
  if (!customer) return {}

  const address = [customer.address, customer.landmark ? `Landmark: ${customer.landmark}` : '']
    .filter(Boolean)
    .join(', ')

  return {
    buyerName: customer.fullName,
    buyerPhone: customer.phone,
    buyerEmail: customer.email || '',
    address,
    pincode: customer.pincode,
    city: customer.city,
    state: customer.state,
    country: customer.country || 'India',
    orderType: customer.paymentMode,
    orderId: `QD-${String(row?.id || Date.now()).slice(0, 8).toUpperCase()}`,
    orderDate: getLocalDateInputValue(),
    products: [{ productName: '', price: 0, quantity: 1 }],
    weight: 0,
    length: 0,
    breadth: 0,
    height: 0,
  }
}

export default function QuickDetailsPage() {
  const [status, setStatus] = useState<QuickDetailStatus>('submitted')
  const [page, setPage] = useState(1)
  const [latestLink, setLatestLink] = useState<QuickDetail | null>(null)
  const [approvingRow, setApprovingRow] = useState<QuickDetail | null>(null)

  const { data, isLoading } = useQuickDetails(page, PAGE_SIZE, status)
  const generateLink = useGenerateQuickDetailLink()
  const rejectQuick = useRejectQuickDetail()
  const approveQuick = useApproveQuickDetail(() => setApprovingRow(null))

  const generatedUrl = getPublicUrl(latestLink)

  const handleGenerate = async () => {
    const response = await generateLink.mutateAsync()
    setLatestLink(response.data)
  }

  const handleCopy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    toast.open({ message: 'Link copied.', severity: 'success' })
  }

  const rows = data?.rows ?? []
  const counts = useMemo(
    () => ({
      submitted: status === 'submitted' ? data?.totalCount ?? 0 : 0,
      rejected: status === 'rejected' ? data?.totalCount ?? 0 : 0,
      approved: status === 'approved' ? data?.totalCount ?? 0 : 0,
    }),
    [data?.totalCount, status],
  )

  const columns: Column<QuickDetail>[] = [
    {
      id: 'token',
      label: 'Order',
      render: (_value, row) => (
        <Stack gap={0.4}>
          <Typography fontWeight={800} color={brand.ink}>
            {row.token.slice(0, 16)}
          </Typography>
          <Typography variant="caption" color={brand.inkSoft}>
            {row.storeName}
          </Typography>
        </Stack>
      ),
    },
    {
      id: 'submittedAt',
      label: 'Date',
      render: (value, row) => {
        const date = value || row.createdAt
        return date ? new Date(date).toLocaleDateString('en-IN') : '-'
      },
    },
    {
      id: 'customerDetails',
      label: 'Customer',
      render: (value: QuickDetail['customerDetails']) =>
        value ? (
          <Stack gap={0.4}>
            <Typography fontWeight={800}>{value.fullName}</Typography>
            <Typography variant="caption" color={brand.inkSoft}>
              {value.phone}
            </Typography>
          </Stack>
        ) : (
          'Not filled'
        ),
    },
    {
      id: 'chargeAmount',
      label: 'Amount',
      render: (_value, row) => (
        <Stack gap={0.6}>
          <Typography fontWeight={900}>₹0.00</Typography>
          <Chip
            label={row.customerDetails?.paymentMode?.toUpperCase() || 'PENDING'}
            size="small"
            sx={{
              width: 'fit-content',
              fontWeight: 800,
              color: '#B45309',
              bgcolor: '#FFF7ED',
              border: '1px solid #FDBA74',
            }}
          />
        </Stack>
      ),
    },
    {
      id: 'status',
      label: 'Actions',
      align: 'right',
      render: (_value, row) =>
        row.status === 'submitted' ? (
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button
              size="small"
              variant="contained"
              startIcon={<MdCheck />}
              onClick={() => setApprovingRow(row)}
              sx={{ bgcolor: '#16A34A', '&:hover': { bgcolor: '#15803D' } }}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<MdClose />}
              onClick={() => rejectQuick.mutate({ id: row.id })}
            >
              Reject
            </Button>
          </Stack>
        ) : (
          <Chip
            label={row.status}
            size="small"
            sx={{ textTransform: 'capitalize', fontWeight: 800 }}
          />
        ),
    },
  ]

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#F5F6FA', minHeight: '100dvh' }}>
      <Stack direction="row" gap={2} alignItems="center" mb={2}>
        <Box
          sx={{
            width: 54,
            height: 54,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            bgcolor: '#2563EB',
            boxShadow: '0 14px 30px rgba(37,99,235,0.26)',
          }}
        >
          <MdShoppingCart size={31} />
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={900} color={brand.ink}>
            Smart Checkout
          </Typography>
          <Typography color={brand.inkSoft}>Generate checkout links and manage orders</Typography>
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: `1px solid ${alpha(brand.ink, 0.08)}`, mb: 3 }}>
        <Typography fontWeight={900} color={brand.ink} mb={2}>
          Generate Unique Link
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
          <Box
            sx={{
              flex: 1,
              px: 2,
              py: 1.7,
              borderRadius: 2,
              border: `1px solid ${alpha(brand.ink, 0.12)}`,
              bgcolor: '#FAFAFA',
              fontFamily: 'monospace',
              fontWeight: 800,
              color: generatedUrl ? '#6D28D9' : brand.inkSoft,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {generatedUrl || 'Generate a one-time customer details link'}
          </Box>
          <Button
            variant="contained"
            startIcon={<BiCopy />}
            onClick={handleCopy}
            disabled={!generatedUrl}
            sx={{ bgcolor: '#4C1D75', px: 3, '&:hover': { bgcolor: '#3B0764' } }}
          >
            Copy
          </Button>
          <Button
            variant="outlined"
            startIcon={generateLink.isPending ? <CircularProgress size={16} /> : <BiRefresh />}
            onClick={handleGenerate}
            disabled={generateLink.isPending}
            sx={{ px: 3 }}
          >
            {latestLink ? 'Regenerate' : 'Generate'}
          </Button>
        </Stack>
      </Paper>

      <Tabs
        value={status}
        onChange={(_event, value) => {
          setStatus(value)
          setPage(1)
        }}
        sx={{
          mb: 2,
          bgcolor: '#fff',
          width: 'fit-content',
          borderRadius: 2,
          boxShadow: '0 8px 22px rgba(15,44,67,0.06)',
        }}
      >
        <Tab icon={<BiLink />} iconPosition="start" label={`New ${counts.submitted || ''}`} value="submitted" />
        <Tab label={`Approved ${counts.approved || ''}`} value="approved" />
        <Tab label={`Rejected ${counts.rejected || ''}`} value="rejected" />
      </Tabs>

      {isLoading ? (
        <Stack alignItems="center" py={8}>
          <CircularProgress />
        </Stack>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          pagination
          currentPage={page}
          onPageChange={setPage}
          totalCount={data?.totalCount ?? 0}
          defaultRowsPerPage={PAGE_SIZE}
          tableVariant="shipment"
        />
      )}

      <CustomDrawer
        open={Boolean(approvingRow)}
        onClose={() => setApprovingRow(null)}
        title="Approve Quick Details"
        width={980}
      >
        <B2COrderFormSteps
          initialValues={buildInitialValues(approvingRow)}
          onClose={() => setApprovingRow(null)}
          submitOverride={(payload: CreateShipmentParams) => {
            if (!approvingRow) return
            approveQuick.mutate({ id: approvingRow.id, payload })
          }}
        />
      </CustomDrawer>
    </Box>
  )
}
