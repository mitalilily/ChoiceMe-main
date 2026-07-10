import {
  alpha,
  Box,
  Chip,
  CircularProgress,
  Container,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { FaAddressBook } from 'react-icons/fa'
import { MdSearch } from 'react-icons/md'
import { useCustomerHistory } from '../../hooks/useCustomerHistory'

const INK = '#171310'
const CLAY = '#D97943'
const TEXT_MUTED = '#74685D'

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

export default function Customers() {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError } = useCustomerHistory()
  const customers = useMemo(() => data?.customers ?? [], [data?.customers])

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return customers

    return customers.filter((customer) =>
      [
        customer.name,
        customer.phone,
        customer.email,
        customer.address,
        customer.city,
        customer.state,
        customer.pincode,
        customer.companyName,
        ...customer.productNames,
      ].some((value) => String(value ?? '').toLowerCase().includes(term)),
    )
  }, [customers, search])

  return (
    <Box sx={{ minHeight: '100%', py: { xs: 2.2, md: 3 } }}>
      <Container maxWidth="xl">
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.2, md: 3 },
              borderRadius: 5,
              border: `1px solid ${alpha(INK, 0.08)}`,
              background: `radial-gradient(circle at 12% 12%, ${alpha(CLAY, 0.18)} 0%, transparent 28%), linear-gradient(135deg, #fffdf8 0%, #f7efe5 100%)`,
              boxShadow: `0 22px 44px ${alpha(INK, 0.08)}`,
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'center' }}
              gap={2}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(CLAY, 0.14),
                    color: CLAY,
                  }}
                >
                  <FaAddressBook size={22} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={900} color={INK}>
                    Previous Customers
                  </Typography>
                  <Typography color={TEXT_MUTED} sx={{ mt: 0.4 }}>
                    Customer details retained in your existing order history.
                  </Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.2} alignItems="center">
                <Chip
                  label={`${customers.length} customer profile${customers.length === 1 ? '' : 's'}`}
                  sx={{ fontWeight: 800, bgcolor: alpha(CLAY, 0.12), color: CLAY }}
                />
                <TextField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customers..."
                  size="small"
                  sx={{ minWidth: { xs: '100%', sm: 300 }, bgcolor: '#fff', borderRadius: 3 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <MdSearch />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Stack>
            </Stack>
          </Paper>

          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 4,
              border: `1px solid ${alpha(INK, 0.08)}`,
              boxShadow: `0 16px 30px ${alpha(INK, 0.05)}`,
            }}
          >
            {isLoading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 280 }} gap={1.5}>
                <CircularProgress size={30} />
                <Typography color={TEXT_MUTED}>Loading customer history…</Typography>
              </Stack>
            ) : isError ? (
              <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
                <Typography color="error">Customer history could not be loaded.</Typography>
              </Stack>
            ) : (
              <Table sx={{ minWidth: 1040 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(INK, 0.035) }}>
                    {['Customer', 'Phone', 'Location', 'Address', 'Products', 'Orders', 'Last order'].map(
                      (heading) => (
                        <TableCell key={heading} sx={{ fontWeight: 900, color: INK }}>
                          {heading}
                        </TableCell>
                      ),
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} hover>
                      <TableCell>
                        <Typography fontWeight={800} color={INK}>{customer.name || '—'}</Typography>
                        <Typography variant="caption" color={TEXT_MUTED}>
                          {customer.email || customer.companyName || 'No email'}
                        </Typography>
                      </TableCell>
                      <TableCell>{customer.phone || '—'}</TableCell>
                      <TableCell>
                        {customer.city || '—'}, {customer.state || '—'}
                        <Typography variant="caption" display="block" color={TEXT_MUTED}>
                          {customer.pincode || 'No pincode'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>{customer.address || '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Stack direction="row" gap={0.6} flexWrap="wrap" useFlexGap>
                          {customer.productNames.slice(0, 3).map((product) => (
                            <Chip key={product} label={product} size="small" />
                          ))}
                          {customer.productNames.length > 3 && (
                            <Chip label={`+${customer.productNames.length - 3}`} size="small" />
                          )}
                          {!customer.productNames.length && '—'}
                        </Stack>
                      </TableCell>
                      <TableCell>{customer.orderCount}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {formatDate(customer.lastOrderAt)}
                        </Typography>
                        <Typography variant="caption" color={TEXT_MUTED}>
                          {customer.lastOrderNumber || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredCustomers.length && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 8, color: TEXT_MUTED }}>
                        {search ? 'No customers match your search.' : 'No previous customers yet.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </Stack>
      </Container>
    </Box>
  )
}
