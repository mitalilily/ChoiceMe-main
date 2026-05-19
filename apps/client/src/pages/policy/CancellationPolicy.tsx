import { Box, Link, List, ListItem, ListItemText, Typography } from '@mui/material'
import PageHeading from '../../components/UI/heading/PageHeading'
import { brandIdentity } from '../../theme/brand'
import { TERMS_REFUND_POLICY_LINE } from '../../utils/constants'

const CancellationPolicy = () => {
  return (
    <Box sx={{ py: 2 }}>
      <PageHeading title="Refund & Cancellation Policy" />

      <List sx={{ listStyleType: 'disc', pl: 3 }}>
        <ListItem sx={{ display: 'list-item' }}>
          <ListItemText
            primary={
              <>
                You may cancel your account at any time by emailing us at{' '}
                <Link href={`mailto:${brandIdentity.supportEmail}`}>{brandIdentity.supportEmail}</Link>{' '}
                or calling{' '}
                <Link href={`tel:${brandIdentity.supportPhone}`}>{brandIdentity.supportPhone}</Link>.
              </>
            }
          />
        </ListItem>

        <ListItem sx={{ display: 'list-item' }}>
          <ListItemText primary="Once your account is cancelled, all of your data and content will be permanently deleted from our Service. Since deletion is final and irreversible, please ensure you truly wish to cancel your account before proceeding." />
        </ListItem>

        <ListItem sx={{ display: 'list-item' }}>
          <ListItemText primary="If you cancel the Service in the middle of a billing cycle, you will receive a final invoice via email. Once that invoice has been paid, no further charges will apply." />
        </ListItem>

        <ListItem sx={{ display: 'list-item' }}>
          <ListItemText primary="ChoiceMee Logistics (ChoiceMee Logistics Pvt Ltd) reserves the right to modify, suspend, or terminate the Service for any reason, without prior notice at any time." />
        </ListItem>

        <ListItem sx={{ display: 'list-item' }}>
          <ListItemText primary="Fraud Prevention: Without limiting any other remedies, ChoiceMee Logistics may suspend or terminate your account if we suspect that you have engaged in fraudulent or unlawful activity in connection with the Platform." />
        </ListItem>

        <ListItem sx={{ display: 'list-item' }}>
          <ListItemText
            primary={
              <Typography
                component="span"
                sx={{
                  fontWeight: 800,
                  color: '#171310',
                  bgcolor: 'rgba(245, 124, 0, 0.12)',
                  borderLeft: '4px solid #F57C00',
                  borderRadius: '8px',
                  px: 1.25,
                  py: 0.85,
                  display: 'inline-block',
                }}
              >
                {TERMS_REFUND_POLICY_LINE}
              </Typography>
            }
          />
        </ListItem>
      </List>
    </Box>
  )
}

export default CancellationPolicy


