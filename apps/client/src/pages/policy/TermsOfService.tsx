import { Box, Link, Typography } from '@mui/material'
import TermsAndConditionsText from '../../components/terms/TermsAndConditionsText'
import PageHeading from '../../components/UI/heading/PageHeading'
import { brandIdentity } from '../../theme/brand'

const TermsOfService = () => {
  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 1, sm: 2 }, py: 2 }}>
      <PageHeading
        title="Terms and Conditions"
        subtitle="Clear operating terms for ChoiceMee account access, shipping, billing, COD, restricted goods, refunds, and privacy."
        eyebrow="Legal"
      />

      <Typography sx={{ mt: 3, color: '#607397', lineHeight: 1.75 }}>
        Please read these terms before creating an account, booking shipments, using wallet or COD
        features, or sharing customer shipment data through ChoiceMee Logistics.{' '}
        For any terms or account question, contact{' '}
        <Link href={`mailto:${brandIdentity.supportEmail}`}>{brandIdentity.supportEmail}</Link> or call{' '}
        <Link href={`tel:${brandIdentity.supportPhone}`}>{brandIdentity.supportPhone}</Link>.
      </Typography>

      <Box sx={{ mt: 2.5 }}>
        <TermsAndConditionsText scrollable={false} />
      </Box>
    </Box>
  )
}

export default TermsOfService
