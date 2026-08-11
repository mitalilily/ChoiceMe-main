import {
  alpha,
  Box,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  MdArrowBack,
  MdEmail,
  MdLocationOn,
  MdNearMe,
  MdOpenInFull,
  MdPerson,
  MdPhone,
} from 'react-icons/md'
import type { ReactNode } from 'react'
import { getCourierDisplayName } from '../../utils/courierDisplay'

type OrderDetailsDialogProps = {
  open: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any | null
  onClose: () => void
}

type DetailItem = {
  label: string
  value?: string | number | null
  icon: ReactNode
}

type ProductRow = {
  productName: string
  hsn: string
  quantity: number
  price: number
  sku: string
}

const emptyText = '-'
const accent = '#10B981'
const panelBorder = '1px solid rgba(15, 23, 42, 0.08)'

const valueOrDash = (value?: string | number | null) => {
  const text = String(value ?? '').trim()
  return text || emptyText
}

const formatCurrency = (value?: string | number | null, decimals = 0) => {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue)) return 'Rs 0'
  return `Rs ${numericValue.toFixed(decimals)}`
}

const toMoneyNumber = (value: unknown) => {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

const normalizeKgValue = (value?: string | number | null) => {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0
  return numericValue > 50 ? numericValue / 1000 : numericValue
}

const formatWeight = (value?: string | number | null) => {
  const kgValue = normalizeKgValue(value)
  if (!kgValue) return '0 Kg'
  const fixedValue = kgValue >= 1 ? kgValue.toFixed(2) : kgValue.toFixed(4)
  return `${fixedValue.replace(/\.?0+$/, '')} Kg`
}

const formatDimensionValue = (value?: string | number | null) => {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '0'
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1)
}

const formatDimensions = (order: OrderDetailsDialogProps['order']) =>
  `${formatDimensionValue(order?.length)} * ${formatDimensionValue(order?.breadth)} * ${formatDimensionValue(order?.height)}`

const normalizeStatus = (status?: string | null) =>
  String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')

const getStatusLabel = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status)
  if (!normalizedStatus || normalizedStatus === 'pending') return 'DRAFT'
  return normalizedStatus.replace(/_/g, ' ').toUpperCase()
}

const getProductRows = (order: OrderDetailsDialogProps['order']): ProductRow[] => {
  const rawProducts = order?.products
  let products: Array<Record<string, unknown>> = []

  if (Array.isArray(rawProducts)) {
    products = rawProducts as Array<Record<string, unknown>>
  } else if (typeof rawProducts === 'string') {
    try {
      const parsedProducts: unknown = JSON.parse(rawProducts)
      products = Array.isArray(parsedProducts) ? (parsedProducts as Array<Record<string, unknown>>) : []
    } catch {
      products = []
    }
  }

  return products.map((product) => ({
    productName: valueOrDash(product.productName as string | undefined) !== emptyText
      ? valueOrDash(product.productName as string | undefined)
      : valueOrDash(product.name as string | undefined),
    hsn: valueOrDash((product.hsnCode ?? product.hsn) as string | number | undefined),
    quantity: Math.max(Number(product.quantity ?? product.qty ?? 1) || 1, 1),
    price: Number(product.price ?? 0) || 0,
    sku: valueOrDash(product.sku as string | undefined),
  }))
}

const getPickupDetails = (order: OrderDetailsDialogProps['order']) => order?.pickup_details || {}

const getSenderName = (order: OrderDetailsDialogProps['order']) => {
  const pickup = getPickupDetails(order)
  return valueOrDash(
    pickup.warehouse_name ||
      pickup.name ||
      pickup.contactName ||
      order?.seller_name ||
      order?.company_name ||
      order?.sender_name,
  )
}

const getSenderAddress = (order: OrderDetailsDialogProps['order']) => {
  const pickup = getPickupDetails(order)
  return valueOrDash(
    pickup.address ||
      pickup.addressLine1 ||
      [pickup.address_line_1, pickup.address_line_2].filter(Boolean).join(', ') ||
      order?.pickup_address ||
      order?.sender_address,
  )
}

const getSenderEmail = (order: OrderDetailsDialogProps['order']) => {
  const pickup = getPickupDetails(order)
  return valueOrDash(pickup.email || pickup.contactEmail || order?.sender_email || order?.user_email)
}

const getSenderPhone = (order: OrderDetailsDialogProps['order']) => {
  const pickup = getPickupDetails(order)
  return valueOrDash(pickup.phone || pickup.contactPhone || order?.sender_phone || order?.user_phone)
}

const getSenderGstin = (order: OrderDetailsDialogProps['order']) => {
  const pickup = getPickupDetails(order)
  return valueOrDash(
    pickup.gst_number || pickup.gstNumber || order?.gstin || order?.company_gst || order?.gst_number,
  )
}

const getOrderValue = (order: OrderDetailsDialogProps['order'], products: ProductRow[]) => {
  const rawOrderValue = Number(order?.order_amount ?? order?.totalAmount ?? 0)
  if (Number.isFinite(rawOrderValue) && rawOrderValue > 0) return rawOrderValue

  return products.reduce((sum, product) => sum + product.price * product.quantity, 0)
}

const getChargeBreakdown = (order: OrderDetailsDialogProps['order'], productValue: number) => {
  const shippingCharges = toMoneyNumber(order?.shipping_charges)
  const otherCharges = toMoneyNumber(order?.other_charges)
  const transactionFee = toMoneyNumber(order?.transaction_fee)
  const giftWrap = toMoneyNumber(order?.gift_wrap)
  const discount = toMoneyNumber(order?.discount)
  const prepaidAmount = toMoneyNumber(order?.prepaid_amount)
  const totalPayable = Math.max(
    0,
    productValue + shippingCharges + transactionFee + giftWrap - discount - prepaidAmount,
  )

  return {
    shippingCharges,
    otherCharges,
    transactionFee,
    giftWrap,
    discount,
    prepaidAmount,
    totalPayable,
  }
}

const IconBubble = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      width: 30,
      height: 30,
      borderRadius: '50%',
      display: 'grid',
      flexShrink: 0,
      placeItems: 'center',
      color: accent,
      bgcolor: alpha(accent, 0.1),
      '& svg': {
        fontSize: 17,
      },
    }}
  >
    {children}
  </Box>
)

const SectionCard = ({
  title,
  children,
  minHeight,
}: {
  title: string
  children: ReactNode
  minHeight?: number
}) => (
  <Paper
    elevation={0}
    sx={{
      minHeight,
      overflow: 'hidden',
      border: panelBorder,
      borderRadius: '8px',
      bgcolor: '#FFFFFF',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    }}
  >
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ px: 2, py: 1.7, borderBottom: panelBorder }}
    >
      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{title}</Typography>
      <MdOpenInFull size={14} color="#9CA3AF" />
    </Stack>
    <Box sx={{ p: 2 }}>{children}</Box>
  </Paper>
)

const DetailList = ({
  items,
  meta,
}: {
  items: DetailItem[]
  meta: Array<{ label: string; value?: string | number | null }>
}) => (
  <Stack spacing={1.25}>
    {items.map((item) => (
      <Stack key={item.label} direction="row" spacing={1.5} alignItems="flex-start">
        <IconBubble>{item.icon}</IconBubble>
        <Box sx={{ minWidth: 0, flex: 1, pb: 1.25, borderBottom: panelBorder }}>
          <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#A7AABC', letterSpacing: 0 }}>
            {item.label}
          </Typography>
          <Typography sx={{ fontSize: 12.2, fontWeight: 800, color: '#111827', wordBreak: 'break-word' }}>
            {valueOrDash(item.value)}
          </Typography>
        </Box>
      </Stack>
    ))}

    <Stack direction="row" spacing={2} sx={{ pt: 0.35 }}>
      {meta.map((item) => (
        <Box key={item.label} sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#A7AABC', letterSpacing: 0 }}>
            {item.label}
          </Typography>
          <Typography sx={{ fontSize: 11.2, fontWeight: 800, color: '#111827', wordBreak: 'break-word' }}>
            {valueOrDash(item.value)}
          </Typography>
        </Box>
      ))}
    </Stack>
  </Stack>
)

const OrderDetailLine = ({
  label,
  value,
  chip,
  emphasized,
}: {
  label: string
  value?: string | number | null
  chip?: boolean
  emphasized?: boolean
}) => (
  <Stack direction="row" spacing={1.25} alignItems="center">
    <Typography sx={{ flex: 1, fontSize: 12.2, color: '#475569' }}>{label}</Typography>
    <Typography sx={{ width: 12, color: '#94A3B8' }}>:</Typography>
    {chip ? (
      <Chip
        size="small"
        label={valueOrDash(value).toUpperCase()}
        sx={{
          height: 21,
          borderRadius: '5px',
          bgcolor: alpha(accent, 0.12),
          color: '#059669',
          '& .MuiChip-label': {
            px: 0.75,
            fontSize: 10,
            fontWeight: 900,
          },
        }}
      />
    ) : (
      <Typography
        sx={{
          minWidth: 112,
          textAlign: 'right',
          fontSize: emphasized ? 17 : 12.2,
          fontWeight: emphasized ? 900 : 800,
          color: '#0F172A',
        }}
      >
        {valueOrDash(value)}
      </Typography>
    )}
  </Stack>
)

const TrackingDetails = ({ order }: { order: OrderDetailsDialogProps['order'] }) => {
  const awb = String(order?.awb_number || '').trim()
  const courierName = getCourierDisplayName({
    name: order?.courier_partner,
    courier_id: order?.courier_id,
    integration_type: order?.integration_type,
  })
  const hasShipment = Boolean(awb || order?.shipment_id || order?.courier_partner)

  if (!hasShipment) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 255 }}>
        <Box
          sx={{
            width: 55,
            height: 55,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: '#C9CED8',
            bgcolor: '#F7F8FA',
            mb: 1.5,
            '& svg': {
              fontSize: 29,
            },
          }}
        >
          <MdNearMe />
        </Box>
        <Typography sx={{ fontSize: 12, color: '#7C8297' }}>
          Shipment not yet initiated
        </Typography>
      </Stack>
    )
  }

  return (
    <Stack spacing={1.25}>
      <OrderDetailLine label="AWB" value={awb || emptyText} />
      <OrderDetailLine label="Courier" value={courierName || emptyText} />
      <OrderDetailLine label="Shipment ID" value={order?.shipment_id || emptyText} />
      <OrderDetailLine label="Status" value={getStatusLabel(order?.order_status)} chip />
    </Stack>
  )
}

const ChargeBreakdown = ({
  productValue,
  breakdown,
}: {
  productValue: number
  breakdown: ReturnType<typeof getChargeBreakdown>
}) => {
  const rows = [
    { label: 'Product Value', value: productValue, emphasized: false, show: true },
    { label: 'Shipping Charges', value: breakdown.shippingCharges, emphasized: false, show: breakdown.shippingCharges > 0 },
    { label: 'Other Charges', value: breakdown.otherCharges, emphasized: false, show: breakdown.otherCharges > 0 },
    { label: 'Transaction Fee', value: breakdown.transactionFee, emphasized: false, show: breakdown.transactionFee > 0 },
    { label: 'Gift Wrap', value: breakdown.giftWrap, emphasized: false, show: breakdown.giftWrap > 0 },
    { label: 'Discount', value: -breakdown.discount, emphasized: false, show: breakdown.discount > 0 },
    { label: 'Prepaid Amount', value: -breakdown.prepaidAmount, emphasized: false, show: breakdown.prepaidAmount > 0 },
  ].filter((row) => row.show)

  return (
    <Stack spacing={1.05}>
      {rows.map((row) => (
        <OrderDetailLine
          key={row.label}
          label={row.label}
          value={formatCurrency(row.value)}
          emphasized={row.emphasized}
        />
      ))}
    </Stack>
  )
}

const ProductDetails = ({ products }: { products: ProductRow[] }) => (
  <Table size="small" sx={{ tableLayout: 'fixed' }}>
    <TableHead>
      <TableRow
        sx={{
          '& th': {
            borderBottom: panelBorder,
            color: '#A7AABC',
            fontSize: 9.5,
            fontWeight: 900,
            letterSpacing: 0,
            py: 1.45,
          },
        }}
      >
        <TableCell>PRODUCT NAME</TableCell>
        <TableCell width="16%">HSN</TableCell>
        <TableCell width="18%" align="center">
          QUANTITY
        </TableCell>
        <TableCell width="18%" align="right">
          PRICE
        </TableCell>
        <TableCell width="14%" align="center">
          SKU
        </TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {(products.length ? products : [{ productName: emptyText, hsn: emptyText, quantity: 1, price: 0, sku: emptyText }]).map(
        (product, index) => (
          <TableRow
            key={`${product.productName}-${index}`}
            sx={{
              '& td': {
                borderBottom: products.length > index + 1 ? panelBorder : 'none',
                py: 1.9,
                fontSize: 12,
                color: '#0F172A',
                fontWeight: 800,
              },
            }}
          >
            <TableCell sx={{ wordBreak: 'break-word' }}>{product.productName}</TableCell>
            <TableCell>{product.hsn}</TableCell>
            <TableCell align="center" sx={{ fontSize: '17px !important', fontWeight: '900 !important' }}>
              {product.quantity}
            </TableCell>
            <TableCell align="right">{formatCurrency(product.price)}</TableCell>
            <TableCell align="center">
              {product.sku === emptyText ? (
                <Box
                  component="span"
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    borderRadius: '5px',
                    bgcolor: '#F5F6F8',
                    color: '#B0B5C2',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  N/A
                </Box>
              ) : (
                product.sku
              )}
            </TableCell>
          </TableRow>
        ),
      )}
    </TableBody>
  </Table>
)

const OrderDetailsDialog = ({ open, order, onClose }: OrderDetailsDialogProps) => {
  const pickup = getPickupDetails(order)
  const products = getProductRows(order)
  const orderValue = getOrderValue(order, products)
  const chargeBreakdown = getChargeBreakdown(order, orderValue)
  const statusLabel = getStatusLabel(order?.order_status)

  const senderItems: DetailItem[] = [
    { label: 'NAME', value: getSenderName(order), icon: <MdPerson /> },
    { label: 'ADDRESS', value: getSenderAddress(order), icon: <MdLocationOn /> },
    { label: 'PHONE', value: getSenderPhone(order), icon: <MdPhone /> },
    { label: 'EMAIL', value: getSenderEmail(order), icon: <MdEmail /> },
  ]

  const receiverItems: DetailItem[] = [
    { label: 'NAME', value: order?.buyer_name || order?.receiver_name, icon: <MdPerson /> },
    { label: 'ADDRESS', value: order?.address || order?.receiver_address, icon: <MdLocationOn /> },
    { label: 'PHONE', value: order?.buyer_phone || order?.receiver_phone, icon: <MdPhone /> },
    { label: 'EMAIL', value: order?.buyer_email || order?.receiver_email, icon: <MdEmail /> },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      scroll="paper"
      PaperProps={{
        sx: {
          m: { xs: 1, md: 2 },
          width: 'min(1120px, calc(100% - 32px))',
          maxHeight: '92vh',
          borderRadius: '10px',
          bgcolor: '#F7F8FA',
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.22)',
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: '#F7F8FA' }}>
        <Stack spacing={2.25}>
          <Stack direction="row" alignItems="center" spacing={1.35}>
            <IconButton
              aria-label="Close order details"
              onClick={onClose}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '7px',
                bgcolor: '#FFFFFF',
                border: panelBorder,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <MdArrowBack size={19} />
            </IconButton>
            <Typography
              sx={{
                fontSize: { xs: 18, sm: 20 },
                fontWeight: 900,
                color: '#0F172A',
                lineHeight: 1.2,
              }}
            >
              Order# <Box component="span" sx={{ color: '#059669' }}>{valueOrDash(order?.order_number || order?.id)}</Box>
            </Typography>
            <Chip
              size="small"
              label={statusLabel}
              sx={{
                height: 22,
                borderRadius: '6px',
                bgcolor: alpha(accent, 0.12),
                color: '#059669',
                '& .MuiChip-label': {
                  px: 0.85,
                  fontSize: 10,
                  fontWeight: 900,
                },
              }}
            />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2.1,
            }}
          >
            <SectionCard title="Sender Details" minHeight={372}>
              <DetailList
                items={senderItems}
                meta={[
                  { label: 'CITY', value: pickup.city || order?.sender_city },
                  { label: 'STATE', value: pickup.state || order?.sender_state },
                  { label: 'PINCODE', value: pickup.pincode || order?.sender_pincode },
                ]}
              />
            </SectionCard>

            <SectionCard title="Receiver Details" minHeight={372}>
              <DetailList
                items={receiverItems}
                meta={[
                  { label: 'CITY', value: order?.city },
                  { label: 'STATE', value: order?.state },
                  { label: 'PINCODE', value: order?.pincode },
                ]}
              />
            </SectionCard>

            <SectionCard title="Tracking Details" minHeight={372}>
              <TrackingDetails order={order} />
            </SectionCard>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(300px, 0.95fr)' },
              gap: 2.1,
            }}
          >
            <SectionCard title="Product Details" minHeight={278}>
              <ProductDetails products={products} />
            </SectionCard>

            <SectionCard title="Order Details" minHeight={278}>
              <Stack spacing={1.65} divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />}>
                <Stack spacing={1.55}>
                  <OrderDetailLine label="Order Number" value={order?.order_number || order?.id} />
                  <OrderDetailLine label="Payment Method" value={order?.order_type || 'prepaid'} chip />
                  <OrderDetailLine label="Dimension" value={formatDimensions(order)} />
                  <OrderDetailLine
                    label="Weight"
                    value={formatWeight(
                      order?.charged_weight ??
                        order?.selected_max_slab_weight ??
                        order?.actual_weight ??
                        order?.weight,
                    )}
                  />
                  <OrderDetailLine
                    label="Final Payable"
                    value={formatCurrency(chargeBreakdown.totalPayable)}
                    emphasized
                  />
                </Stack>
                <ChargeBreakdown productValue={orderValue} breakdown={chargeBreakdown} />
                <OrderDetailLine label="GSTIN" value={getSenderGstin(order)} />
              </Stack>
            </SectionCard>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export default OrderDetailsDialog
