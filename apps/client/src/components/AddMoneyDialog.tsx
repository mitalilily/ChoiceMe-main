// components/wallet/AddMoneyDialog.tsx
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { FiX } from 'react-icons/fi'
import { useAuth } from '../context/auth/AuthContext'
import { useUserProfile } from '../hooks/User/useUserProfile'
import { usePaymentOptions } from '../hooks/usePaymentOptions'
import { useRechargeWallet } from '../hooks/useRechargeWallets'
import { brand } from '../theme/brand'
import { toast } from './UI/Toast'

const WALLET_ORANGE = brand.accent
const WALLET_TEXT = brand.ink
const WALLET_MUTED = '#6F7480'

interface AddMoneyDialogProps {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  currentBalance: number
}

const quickAmounts = [300, 500, 1000, 2000, 5000]

const AddMoneyDialog: React.FC<AddMoneyDialogProps> = ({ open, setOpen }) => {
  const { user } = useAuth()
  const [amount, setAmount] = useState<number>(500)
  const recharge = useRechargeWallet()
  const { data: paymentOptions, refetch: refetchPaymentOptions } = usePaymentOptions()
  const { data: profile } = useUserProfile(true)

  const minWalletRecharge = paymentOptions?.minWalletRecharge ?? 0
  const effectiveAmount = amount || 0
  const kycStatus = profile?.domesticKyc?.status
  const isKycBlocked = kycStatus !== 'verified'

  const handleRecharge = async () => {
    if (isKycBlocked) {
      toast.open({
        message:
          kycStatus === 'pending' || kycStatus === 'verification_in_progress'
            ? 'KYC verification is not completed yet. You can recharge once your KYC is verified.'
            : 'Please complete your KYC to recharge your wallet.',
        severity: 'warning',
      })
      return
    }

    const latestPaymentOptions = await refetchPaymentOptions()
    const latestMinWalletRecharge =
      latestPaymentOptions.data?.minWalletRecharge ?? minWalletRecharge ?? 0
    const isBelowLatestMin =
      latestMinWalletRecharge > 0 && effectiveAmount < latestMinWalletRecharge

    if (isBelowLatestMin) {
      toast.open({
        message: `Minimum wallet recharge amount is ₹${latestMinWalletRecharge.toLocaleString('en-IN')}`,
        severity: 'warning',
      })
      return
    }

    try {
      await recharge.mutateAsync({
        amount,
        prefill: {
          name:
            user?.companyInfo?.businessName ||
            user?.companyInfo?.contactPerson ||
            user?.name ||
            'ChoiceMee Customer',
          email: user?.companyInfo?.contactEmail ?? '',
          contact: user?.companyInfo?.contactNumber ?? '',
        },
      })
      setOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Recharge failed!'
      toast.open({
        message,
        severity: message === 'Payment cancelled' ? 'warning' : 'error',
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      fullWidth
      maxWidth={false}
      BackdropProps={{
        sx: {
          backgroundColor: alpha('#0B0F18', 0.55),
          backdropFilter: 'blur(9px)',
        },
      }}
      PaperProps={{
        sx: {
          width: { xs: 'calc(100vw - 32px)', sm: 460 },
          maxWidth: 'calc(100vw - 32px)',
          m: 2,
          border: 'none',
          borderRadius: { xs: '22px', sm: '24px' },
          background: '#FFFFFF',
          boxShadow: '0 22px 60px rgba(13, 27, 77, 0.2)',
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          boxSizing: 'border-box',
          width: '100%',
          px: { xs: 2.5, sm: 3.2 },
          pt: { xs: 3.4, sm: 3.8 },
          pb: { xs: 2.8, sm: 3.2 },
        }}
      >
        <IconButton
          aria-label="Close wallet recharge dialog"
          onClick={() => setOpen(false)}
          sx={{
            position: 'absolute',
            top: { xs: 16, sm: 18 },
            right: { xs: 16, sm: 18 },
            width: { xs: 38, sm: 40 },
            height: { xs: 38, sm: 40 },
            borderRadius: '50%',
            color: '#747781',
            bgcolor: '#F3F3F4',
            '&:hover': {
              bgcolor: '#ECECEF',
              color: WALLET_TEXT,
            },
          }}
        >
          <FiX size={21} />
        </IconButton>

        <Typography
          sx={{
            pr: { xs: 5.5, sm: 7 },
            color: WALLET_TEXT,
            fontSize: { xs: '1.36rem', sm: '1.46rem' },
            lineHeight: 1.1,
            fontWeight: 500,
            letterSpacing: 0,
          }}
        >
          Recharge your wallet
        </Typography>
        <Typography
          sx={{
            mt: 1.2,
            color: WALLET_MUTED,
            fontSize: { xs: '0.9rem', sm: '0.94rem' },
            lineHeight: 1.25,
            fontWeight: 400,
            letterSpacing: 0,
          }}
        >
          Enter the amount you want to recharge
        </Typography>

        <Box sx={{ mt: { xs: 2.1, sm: 2.3 } }}>
          <TextField
            type="number"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            variant="standard"
            placeholder="Enter Amount"
            fullWidth
            slotProps={{
              input: {
                disableUnderline: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography
                      component="span"
                      sx={{
                        color: '#747A84',
                        fontSize: { xs: '1.18rem', sm: '1.28rem' },
                        fontWeight: 500,
                        lineHeight: 1,
                      }}
                    >
                      ₹
                    </Typography>
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography
                      component="span"
                      sx={{
                        color: '#747A84',
                        fontSize: { xs: '1.14rem', sm: '1.24rem' },
                        fontWeight: 500,
                        lineHeight: 1,
                      }}
                    >
                      .00
                    </Typography>
                  </InputAdornment>
                ),
                sx: {
                  width: '100%',
                  height: { xs: 62, sm: 66 },
                  px: { xs: 1.8, sm: 2 },
                  borderRadius: { xs: '16px', sm: '18px' },
                  bgcolor: '#F7F7F8',
                  border: '2px solid #E4E4E6',
                  boxShadow: 'inset 0 2px 4px rgba(13, 27, 77, 0.04)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  '&.Mui-focused': {
                    borderColor: alpha(WALLET_TEXT, 0.22),
                    boxShadow: `0 0 0 4px ${alpha(WALLET_TEXT, 0.04)}, inset 0 2px 4px rgba(13, 27, 77, 0.04)`,
                  },
                },
                inputProps: {
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                  style: {
                    color: WALLET_TEXT,
                    fontWeight: 500,
                    MozAppearance: 'textfield',
                  },
                },
              },
            }}
            sx={{
              '& .MuiInputBase-input': {
                px: { xs: 0.9, sm: 1.1 },
                py: 0,
                height: 'auto',
                color: WALLET_TEXT,
                fontSize: { xs: '1.34rem', sm: '1.42rem' },
                lineHeight: 1,
                fontWeight: 500,
                letterSpacing: 0,
              },
              '& .MuiInputBase-input::placeholder': {
                color: alpha(WALLET_TEXT, 0.36),
                opacity: 0.7,
              },
              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                WebkitAppearance: 'none',
                margin: 0,
              },
              '& input[type=number]': { MozAppearance: 'textfield' },
            }}
          />
        </Box>

        <Stack
          direction="row"
          flexWrap="wrap"
          gap={{ xs: 1, sm: 1.2 }}
          sx={{ mt: { xs: 1.9, sm: 2.1 } }}
        >
          {quickAmounts.map((value) => (
            <Button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              sx={{
                minWidth: { xs: value === 5000 ? 106 : 92, sm: value === 5000 ? 108 : 94 },
                height: { xs: 42, sm: 44 },
                px: { xs: 1.25, sm: 1.35 },
                borderRadius: '12px',
                border: '1px solid #E7E8EB',
                bgcolor: '#FFFFFF',
                color: WALLET_TEXT,
                boxShadow: '0 4px 12px rgba(13, 27, 77, 0.02)',
                fontSize: { xs: '0.88rem', sm: '0.92rem' },
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: 0,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#FFFFFF',
                  borderColor: alpha(WALLET_TEXT, 0.18),
                  boxShadow: '0 10px 22px rgba(13, 27, 77, 0.08)',
                },
              }}
            >
              + ₹{value.toLocaleString('en-IN')}
            </Button>
          ))}
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={{ xs: 1.1, sm: 1.4 }}
          sx={{ mt: { xs: 2.6, sm: 2.8 } }}
        >
          <Button
            type="button"
            onClick={() => setOpen(false)}
            sx={{
              flex: 1,
              height: { xs: 50, sm: 52 },
              borderRadius: '14px',
              border: '1px solid #E6E7EA',
              bgcolor: '#FFFFFF',
              color: WALLET_TEXT,
              boxShadow: 'none',
              fontSize: { xs: '0.96rem', sm: '1rem' },
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: 0,
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#FFFFFF',
                borderColor: alpha(WALLET_TEXT, 0.16),
              },
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleRecharge}
            disabled={recharge.isPending || effectiveAmount <= 0}
            sx={{
              flex: 1,
              height: { xs: 50, sm: 52 },
              borderRadius: '14px',
              bgcolor: WALLET_ORANGE,
              color: '#FFFFFF',
              boxShadow: `0 16px 30px ${alpha(WALLET_ORANGE, 0.22)}`,
              fontSize: { xs: '0.96rem', sm: '1rem' },
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: 0,
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#F17818',
                boxShadow: `0 18px 34px ${alpha(WALLET_ORANGE, 0.28)}`,
              },
              '&:disabled': {
                bgcolor: alpha(WALLET_ORANGE, 0.46),
                color: alpha('#FFFFFF', 0.86),
              },
            }}
          >
            {recharge.isPending ? (
              <Stack direction="row" alignItems="center" gap={1}>
                <CircularProgress size={20} thickness={4} sx={{ color: 'currentColor' }} />
                <Box component="span">Recharging...</Box>
              </Stack>
            ) : (
              'Recharge'
            )}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  )
}

export default AddMoneyDialog
