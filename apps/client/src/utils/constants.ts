import type { AdditionalKYCForm } from '../components/user/profile/Kyc/AdditionalInfoStep'
import type { BusinessStructure, CompanyType } from '../types/generic.types'

export const TERMS_OPERATOR_LINE = 'These terms are issued by ChoiceMee Logistics for use of the ChoiceMee platform.'
export const TERMS_REFUND_POLICY_LINE =
  'Refund policy: approved refunds are credited to the original payment method or verified bank account within 7 business days.'
export const TERMS_PRIVACY_POLICY_LINE =
  'Privacy policy: we collect, use, store, and share account, KYC, shipment, billing, tracking, and support information only to operate the platform, meet courier and legal requirements, prevent fraud, improve services, and communicate with you.'
export const TERMS_HIGHLIGHT_LINES = [
  TERMS_OPERATOR_LINE,
  TERMS_REFUND_POLICY_LINE,
  TERMS_PRIVACY_POLICY_LINE,
]
export const TERMS_SECTION_TITLES = [
  'Account Eligibility',
  'Platform Use',
  'Shipping and Courier Services',
  'Rates, Wallet, and Payments',
  'COD and Remittance',
  'Cancellations and Refunds',
  'Restricted and Prohibited Shipments',
  'Data and Privacy',
  'Service Availability and Liability',
  'Suspension and Termination',
  'Updates to These Terms',
  'Contact and Grievance',
]

export const TERMS_AND_CONDITIONS = `
${TERMS_OPERATOR_LINE}

Last updated: 18 May 2026

Account Eligibility
- You must be at least 18 years old and legally able to enter into a binding agreement.
- You must provide accurate registration, contact, business, KYC, pickup, billing, and bank details when requested.
- You are responsible for all activity under your account and for keeping your login credentials secure.
- If any information changes, you must update it promptly so shipments, invoices, remittances, and support communication remain accurate.

Platform Use
- ChoiceMee Logistics provides tools for shipment booking, rate calculation, label generation, courier allocation, tracking, wallet management, COD visibility, NDR/RTO workflows, reports, and related support.
- You must use the platform only for lawful business shipping activity and in line with applicable Indian laws, courier rules, and these terms.
- You must not misuse the platform, attempt unauthorized access, upload harmful code, interfere with systems, or use the service for fraudulent or misleading activity.
- You remain responsible for the accuracy of order details, pickup and delivery addresses, parcel dimensions, parcel weight, product descriptions, invoice values, and payment mode.

Shipping and Courier Services
- Courier serviceability, pickup availability, transit time, delivery attempt rules, RTO handling, weight disputes, and tracking updates depend on the integrated courier and lane.
- A shipment is accepted for processing only after required shipment data, courier allocation, and manifest requirements are completed.
- AWB generation, manifesting, pickup scans, transit scans, and final delivery events may be delayed by courier systems, network conditions, address issues, weather, strikes, holidays, or regulatory checks.
- You agree to cooperate with support requests for invoices, product proofs, KYC documents, customer details, weight evidence, or other information required to resolve courier exceptions.

Rates, Wallet, and Payments
- Rate calculator amounts are estimates until the shipment is validated, manifested, scanned, and billed using the final applicable weight, zone, plan, payment mode, and charges.
- You must maintain sufficient wallet balance or approved payment terms before shipment processing where payment is required.
- Applicable charges may include freight, COD charges, fuel surcharge, GST, weight discrepancy charges, RTO charges, address correction fees, remote area charges, and other courier or platform charges.
- Invoices and statements must be reviewed promptly. Any billing concern should be raised with supporting details within the timeline communicated by ChoiceMee Logistics.

COD and Remittance
- COD collections are handled according to courier confirmations, remittance cycles, reconciliation data, deductions, and platform records.
- COD remittance may be adjusted for shipping charges, RTO charges, disputes, penalties, refunds, negative wallet balance, or other valid dues.
- You are responsible for providing correct bank and settlement details and for reviewing remittance reports.

Cancellations and Refunds
- You may request cancellation of shipments or services through the available platform flow or by contacting support.
- Cancellation is subject to shipment status, courier acceptance, manifest status, pickup status, and charges already incurred.
- Once an account cancellation is completed, access may be disabled and retained data may be deleted or archived as required by law, courier reconciliation, accounting, fraud prevention, or dispute handling.
- ${TERMS_REFUND_POLICY_LINE}

Restricted and Prohibited Shipments
- You must not ship illegal, unsafe, counterfeit, misdeclared, restricted, or prohibited goods.
- Restricted categories include weapons, explosives, narcotics, psychotropic substances, liquor, tobacco where restricted, hazardous materials, live or dead animals or protected animal products, cash, negotiable instruments, securities, antiques, art treasures, used SIM cards, and any item prohibited by law or courier policy.
- You are responsible for product declarations, invoices, tax compliance, packaging, and customer communication for every shipment.
- ChoiceMee Logistics may hold, cancel, reject, or report shipments if the parcel or declaration appears suspicious, unsafe, restricted, unlawful, or non-compliant.

Data and Privacy
- ${TERMS_PRIVACY_POLICY_LINE}
- By using the platform, you consent to this processing and to sharing relevant shipment, customer, KYC, billing, and tracking information with couriers, payment processors, technology providers, auditors, legal authorities, and support teams where necessary.
- You must provide your customers with appropriate notices and permissions before sharing their personal data with ChoiceMee Logistics for shipment processing, tracking, COD, NDR, RTO, support, and communication.
- You can request correction, access, or deletion of eligible personal information by contacting ops@choicemee.com or 9906690088, subject to legal, accounting, courier, fraud-prevention, and dispute-retention requirements.

Service Availability and Liability
- The platform is provided on an as-is and as-available basis. We work to keep it reliable, but we do not guarantee uninterrupted, error-free, or delay-free operation.
- ChoiceMee Logistics is not liable for indirect, incidental, special, consequential, or loss-of-profit damages arising from platform use, courier delays, failed pickups, delivery exceptions, third-party outages, or inaccurate information submitted by you.
- Nothing in these terms limits liability that cannot legally be limited.

Suspension and Termination
- We may suspend or restrict access if we detect fraud risk, abusive behavior, unpaid dues, prohibited shipments, policy violations, courier complaints, security concerns, or unlawful activity.
- You may stop using the platform or request account closure by contacting ops@choicemee.com or 9906690088.
- Outstanding charges, reconciliation items, claims, disputes, and legal obligations survive account closure.

Updates to These Terms
- We may update these terms to reflect service changes, courier requirements, legal obligations, pricing changes, or operational improvements.
- Continued use of the platform after an update means you accept the revised terms.

Contact and Grievance
- For terms, privacy, billing, shipment, refund, or grievance questions, contact ChoiceMee Logistics at ops@choicemee.com or 9906690088.
`

// components/layout/constants.ts
export const DRAWER_WIDTH = 280
export const NAVBAR_HEIGHT = 80
export const RADIUS = 8 // master corner radius
export const ACTIVE_BG = 'rgba(10, 78, 163, 0.08)' // background behind selected item
export const ACTIVE_BAR = '#F57C00' // primary brand color bar at far left
export const ACCENT = '#0A4EA3' // primary brand color accent

export const requiredKycDetails: Record<
  BusinessStructure,
  (keyof AdditionalKYCForm)[] | Record<CompanyType, (keyof AdditionalKYCForm)[]>
> = {
  individual: ['panCardUrl', 'aadhaarFrontUrl', 'aadhaarBackUrl', 'cancelledChequeUrl'],
  sole_proprietor: [
    'panCardUrl',
    'aadhaarFrontUrl',
    'aadhaarBackUrl',
    'cancelledChequeUrl',
    'gstin',
    'gstCertificateUrl',
  ],
  partnership_firm: [
    'partnershipDeedUrl',
    'panCardUrl',
    'aadhaarFrontUrl',
    'aadhaarBackUrl',
    'cancelledChequeUrl',
    'gstin',
    'gstCertificateUrl',
  ],
  company: {
    private_limited: [
      'cin',
      'gstin',
      'gstCertificateUrl',
      'boardResolutionUrl',
      'businessPanUrl',
      'aadhaarFrontUrl',
      'aadhaarBackUrl',
    ],
    llp: [
      'businessPanUrl',
      'aadhaarFrontUrl',
      'aadhaarBackUrl',
      'companyAddressProofUrl',
      'cancelledChequeUrl',
      'llpAgreementUrl',
      'gstin',
      'gstCertificateUrl',
    ],
    one_person_company: [
      'businessPanUrl',
      'aadhaarFrontUrl',
      'aadhaarBackUrl',
      'cin',
      'companyAddressProofUrl',
      'cancelledChequeUrl',
    ],
    section_8_company: [
      'businessPanUrl',
      'aadhaarFrontUrl',
      'aadhaarBackUrl',
      'companyAddressProofUrl',
      'boardResolutionUrl',
      'cancelledChequeUrl',
    ],
    public_limited: [
      'businessPanUrl',
      'aadhaarFrontUrl',
      'aadhaarBackUrl',
      'gstin',
      'gstCertificateUrl',
    ],
  },
}

export const requiredKycFieldMap: Record<
  BusinessStructure,
  Record<string, boolean> | Record<CompanyType, Record<string, boolean>>
> = {
  individual: {
    panCardUrl: true,
    aadhaarFrontUrl: true,
    aadhaarBackUrl: true,
    cancelledChequeUrl: true,
  },
  sole_proprietor: {
    panCardUrl: true,
    aadhaarFrontUrl: true,
    aadhaarBackUrl: true,
    cancelledChequeUrl: true,
    gstin: false,
    gstCertificateUrl: false,
  },
  partnership_firm: {
    partnershipDeedUrl: true,
    panCardUrl: true,
    aadhaarFrontUrl: true,
    aadhaarBackUrl: true,
    cancelledChequeUrl: true,
    gstin: false,
    gstCertificateUrl: false,
  },
  company: {
    private_limited: {
      cin: true,
      gstin: false,
      gstCertificateUrl: true,
      boardResolutionUrl: true,
      businessPanUrl: true,
      aadhaarFrontUrl: true,
      aadhaarBackUrl: true,
    },
    llp: {
      businessPanUrl: true,
      aadhaarFrontUrl: true,
      aadhaarBackUrl: true,
      companyAddressProofUrl: true,
      cancelledChequeUrl: true,
      llpAgreementUrl: true,
      gstin: false,
      gstCertificateUrl: false,
    },
    one_person_company: {
      businessPanUrl: true,
      aadhaarFrontUrl: true,
      aadhaarBackUrl: true,
      cin: true,
      companyAddressProofUrl: true,
      cancelledChequeUrl: true,
    },
    section_8_company: {
      businessPanUrl: true,
      aadhaarFrontUrl: true,
      aadhaarBackUrl: true,
      companyAddressProofUrl: true,
      boardResolutionUrl: true,
      cancelledChequeUrl: true,
    },
    public_limited: {
      businessPanUrl: true,
      aadhaarFrontUrl: true,
      aadhaarBackUrl: true,
      gstin: false,
      gstCertificateUrl: true,
    },
  },
}

export const deliveryOneLogo = '/logo/integrations/delivery-one-logo.webp'

export const courierLogos: Record<string, string> = {
  Delhivery: deliveryOneLogo,
  'Delhivery Surface': deliveryOneLogo,
  'Delhivery Express': deliveryOneLogo,
  'Delhivery Air': deliveryOneLogo,
  'Delivery One': deliveryOneLogo,
  'Delivery One Surface': deliveryOneLogo,
  'Delivery One Express': deliveryOneLogo,
  deliveryone: deliveryOneLogo,
  delhiveryone: deliveryOneLogo,
  'Delhivery One': deliveryOneLogo,
  Bluedart: '/logo/integrations/bluedart.png',
  Shadowfax: '/logo/integrations/shadowfax.png',
  DTDC: '/logo/integrations/dtdc.png',
  Gati: 'https://cdn.example.com/logos/gati.png',
  EcomExpress: '/logo/integrations/ecomexpress.webp',
  Amazon: '/logo/integrations/amazon.png',
  Ekart: '/logo/integrations/ekart.png',
  Xpressbees: '/logo/integrations/xpressbees.png',
}
export const defaultLogo = '/logo/integrations/default-courier.png'


