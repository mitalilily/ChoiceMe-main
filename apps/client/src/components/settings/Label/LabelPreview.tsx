/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Paper, Stack, Typography } from '@mui/material'
import Barcode from 'react-barcode'
import type { LabelPreferences } from '../../../api/labelPreference.api'
import { getCourierDisplayName } from '../../../utils/courierDisplay'

const normalize = (value: unknown) => {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value.trim() : `${value}`
}

const clampText = (value: unknown, max = 25) => {
  const text = normalize(value)
  if (!text) return '-'
  return text.length > max ? `${text.slice(0, max)}...` : text
}

const pickFirst = (...values: unknown[]) => values.map(normalize).find(Boolean) || ''

const isEnabled = (value: unknown) => (value === undefined ? true : value === true)

const buildDimensions = (order: any) => {
  const dimension = normalize(order.dimension) || normalize(order.dimensions)
  if (dimension) return dimension.replace(/x/g, ' x ')
  if (order.length && order.breadth && order.height) {
    return `${order.length} x ${order.breadth} x ${order.height}`
  }
  return ''
}

const buildWeight = (order: any) => {
  if (order.deadWeight) return normalize(order.deadWeight)
  if (order.weightKg) return `${order.weightKg} kgs`
  if (order.weight) {
    const raw = Number(order.weight)
    const kg = Number.isFinite(raw) && raw > 20 ? raw / 1000 : raw
    return `${kg} kgs`
  }
  return ''
}

type LabelPreviewProps = {
  values: any
  order: any
  preferences?: LabelPreferences
}

export function LabelPreview({ values, order }: LabelPreviewProps) {
  const charsLimit = Math.max(5, Number(values?.charLimit ?? 25))
  const maxItems = Math.max(1, Number(values?.maxItems ?? 3))

  const awbNumber = pickFirst(order.awb, order.awbNumber, order.awb_number)
  const courierName = getCourierDisplayName(
    {
      name: order.courier || order.courier_partner,
      courier_id: order.courierId ?? order.courier_id,
      integration_type: order.integration_type,
      mode: order.shipping_mode,
    },
    'Courier',
  )
  const paymentType = (normalize(order.paymentType) || normalize(order.payment_type) || 'prepaid').toLowerCase()
  const paymentLabel = paymentType === 'cod' ? 'COD' : 'Prepaid'
  const paymentInstruction =
    paymentType === 'cod'
      ? `Collect ${pickFirst(order.codValue, order.cod_amount, order.totalAmount, order.orderValue)}`
      : 'No amount to be collected'

  const productEntries = Array.isArray(order.products) ? order.products.slice(0, maxItems) : []
  const orderId = pickFirst(order.orderId, order.order_id, order.order_number)
  const referenceOrder = pickFirst(order.referenceOrder, order.order_number, order.orderId)
  const invoiceNumber = pickFirst(order.invoiceNumber, order.invoice_number)
  const orderValue = pickFirst(order.totalAmount, order.orderValue, order.order_amount, order.declaredValue)
  const customerPhone = pickFirst(order.phone, order.buyer_phone, order.customerPhone)
  const sortCode = pickFirst(order.sortCode, order.sort_code, order.routing_code)
  const dimensionValue = buildDimensions(order)
  const weightValue = buildWeight(order)

  const showLogo = isEnabled(values.shipperInfo?.brandLogo)
  const showSellerName = isEnabled(values.shipperInfo?.sellerBrandName)
  const showShipperAddress = isEnabled(values.shipperInfo?.shipperAddress)
  const showShipperPhone = isEnabled(values.shipperInfo?.shipperPhone)
  const showShipperGst = isEnabled(values.shipperInfo?.gstin)
  const showReturnAddress = isEnabled(values.shipperInfo?.rtoAddress)
  const showCustomerPhone = isEnabled(values.orderInfo?.customerPhone) && Boolean(customerPhone)
  const showOrderId = isEnabled(values.orderInfo?.orderId) && Boolean(orderId)
  const showInvoiceNumber = isEnabled(values.orderInfo?.invoiceNumber) && Boolean(invoiceNumber)
  const showDeclaredValue = isEnabled(values.orderInfo?.declaredValue) && Boolean(orderValue)
  const showAwb = isEnabled(values.orderInfo?.awb) && Boolean(awbNumber)
  const showDimensions = isEnabled(values.productInfo?.dimension) && Boolean(dimensionValue)
  const showWeight = isEnabled(values.productInfo?.deadWeight) && Boolean(weightValue)
  const showSortCode = isEnabled(values.orderInfo?.rtoRoutingCode) && Boolean(sortCode)
  const showCodBanner = isEnabled(values.orderInfo?.cod)

  const productColumns = [
    { key: 'name', label: 'Product Name', enabled: isEnabled(values.productInfo?.itemName), width: '48%' },
    { key: 'sku', label: 'SKU', enabled: isEnabled(values.productInfo?.skuCode), width: '26%' },
    { key: 'qty', label: 'Quantity', enabled: isEnabled(values.productInfo?.productQuantity), width: '26%' },
    { key: 'amount', label: 'Amount', enabled: isEnabled(values.productInfo?.productCost), width: '26%' },
  ].filter((column) => column.enabled)

  const productValue = (product: any, key: string) => {
    if (key === 'sku') return normalize(product.sku ?? product.skuCode) || '-'
    if (key === 'qty') return normalize(product.qty ?? product.quantity ?? 1)
    if (key === 'amount') return normalize(product.price) || '-'
    return clampText(product.name ?? product.productName, charsLimit)
  }

  const shipperName = pickFirst(order.shipper?.name, 'Client Store')
  const shipperAddress = pickFirst(order.shipper?.rtoAddress, order.shipper?.address)
  const showShipperBlock =
    showSellerName ||
    showShipperAddress ||
    (showShipperPhone && Boolean(order.shipper?.phone)) ||
    (showShipperGst && Boolean(order.shipper?.gst))

  return (
    <Paper
      sx={{
        p: 1.25,
        border: '1.5px solid #111',
        borderRadius: 0,
        width: values.printer === 'thermal' ? '100mm' : '210mm',
        minHeight: values.printer === 'thermal' ? '150mm' : '297mm',
        bgcolor: '#fff',
        color: '#111',
        mx: 'auto',
        fontFamily: 'Arial, sans-serif',
      }}
      elevation={0}
    >
      <Stack spacing={1.15}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ width: 76 }}>
            {showLogo ? (
              <Box
                sx={{
                  width: 58,
                  height: 28,
                  bgcolor: '#d8c7ad',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9a3412',
                  fontSize: 9,
                  fontWeight: 800,
                  fontStyle: 'italic',
                  lineHeight: 1,
                  textAlign: 'center',
                }}
              >
                Client
                <br />
                Logo
              </Box>
            ) : null}
          </Box>
          <Box sx={{ width: 148 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>Shipping Label</Typography>
            {showOrderId && <Typography sx={{ fontSize: 10 }}>Order# : {orderId}</Typography>}
            <Typography sx={{ fontSize: 7 }}>Generated on: Tue, 16 Dec 2025 11:54:40 IST</Typography>
          </Box>
        </Stack>

        {showCodBanner && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '68px 1fr',
              border: '1.5px solid #111',
              '& > div': { py: 1.05, textAlign: 'center', fontSize: 14, fontWeight: 800 },
              '& > div:first-of-type': { borderRight: '1.5px solid #111' },
            }}
          >
            <Box>{paymentLabel}</Box>
            <Box>{paymentInstruction}</Box>
          </Box>
        )}

        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Courier: {courierName}</Typography>
            {showDeclaredValue && (
              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Order Value: {orderValue}</Typography>
            )}
            {showOrderId && <Typography sx={{ fontSize: 8 }}>Reference Order# : {referenceOrder}</Typography>}
            {showInvoiceNumber && <Typography sx={{ fontSize: 8 }}>Invoice# : {invoiceNumber}</Typography>}
            {showAwb && <Typography sx={{ fontSize: 8 }}>AWB# : {awbNumber}</Typography>}
            {showDimensions && <Typography sx={{ fontSize: 8 }}>Dimensions: {dimensionValue} (L W H)</Typography>}
            {showWeight && <Typography sx={{ fontSize: 8 }}>Weight: {weightValue}</Typography>}
            {showSortCode && <Typography sx={{ fontSize: 8 }}>Sort Code: {sortCode}</Typography>}
          </Box>
          {showAwb && (
            <Box sx={{ width: 108, overflow: 'hidden', pt: 0.25 }}>
              <Barcode value={awbNumber} height={40} width={1.1} fontSize={12} margin={0} />
            </Box>
          )}
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ maxWidth: 220 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800 }}>To: {order.name}</Typography>
            <Typography sx={{ fontSize: 14, lineHeight: 1.12 }}>{order.address}</Typography>
            {showCustomerPhone && <Typography sx={{ fontSize: 9 }}>Contact: {customerPhone}</Typography>}
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              mt: 1,
              background:
                'repeating-linear-gradient(90deg, #111 0 4px, transparent 4px 8px), repeating-linear-gradient(0deg, rgba(17,17,17,0.55) 0 4px, transparent 4px 8px)',
            }}
          />
        </Stack>

        <Box sx={{ width: 214, borderTop: '2px dashed #111' }} />

        {showShipperBlock && (
          <Box>
            {showSellerName && <Typography sx={{ fontSize: 13, fontWeight: 800 }}>From:{shipperName}</Typography>}
            {showShipperAddress && (
              <>
                <Typography sx={{ fontSize: 10, fontWeight: 800 }}>
                  {showReturnAddress ? 'Return to if undelivered:' : 'Pickup address:'}
                </Typography>
                {showSellerName && <Typography sx={{ fontSize: 9 }}>Store name {shipperName}</Typography>}
                <Typography sx={{ fontSize: 9, lineHeight: 1.15 }}>{shipperAddress}</Typography>
              </>
            )}
            {showShipperPhone && order.shipper?.phone && (
              <Typography sx={{ fontSize: 9 }}>Contact: {order.shipper.phone}</Typography>
            )}
            {showShipperGst && order.shipper?.gst && (
              <Typography sx={{ fontSize: 9 }}>GSTIN: {order.shipper.gst}</Typography>
            )}
          </Box>
        )}

        {productColumns.length > 0 && (
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mt: 0.5 }}>
            <Box component="thead">
              <Box component="tr" sx={{ borderTop: '1px solid #111', borderBottom: '2px solid #111' }}>
                {productColumns.map((column) => (
                  <Box
                    component="th"
                    key={column.key}
                    align={column.key === 'name' ? 'left' : 'center'}
                    sx={{ width: column.width, py: 0.7, fontSize: 10 }}
                  >
                    {column.label}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {(productEntries.length ? productEntries : [{}]).map((product: any, index: number) => (
                <Box
                  component="tr"
                  key={`${product.name || 'product'}-${index}`}
                  sx={{ borderBottom: '1px solid #111' }}
                >
                  {productColumns.map((column) => (
                    <Box
                      component="td"
                      key={column.key}
                      align={column.key === 'name' ? 'left' : 'center'}
                      sx={{ py: 0.35, fontSize: 9 }}
                    >
                      {productValue(product, column.key)}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}
