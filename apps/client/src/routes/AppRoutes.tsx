// AppRoutes.tsx
import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import RequireAuth from '../components/auth/wrapper/RequireAuth'
import RequireMerchantReady from '../components/auth/wrapper/RequireMerchantReady'
import RequireOnboard from '../components/auth/wrapper/RequireOnboard'
import Layout from '../components/UI/Layout'
import FullScreenLoader from '../components/UI/loader/FullScreenLoader'
import NavigationLoader from '../components/UI/loader/NavigationLoader'
import { useAuth } from '../context/auth/AuthContext'
import Login from '../pages/auth/Login'
import Signup from '../pages/auth/Signup'
import ClientPreview from '../pages/preview/ClientPreview'
import AppEntry from './AppEntry'
import GlobalRedirectHandler from './WalletRedirectHandler'

/* ---------- Lazy-loaded components ---------- */
// Onboarding & Dashboard
const UserOnboarding = lazy(() => import('../pages/onboarding/UserOnboarding'))
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'))
const LandingPage = lazy(() => import('../pages/LandingPage'))

// Orders
const Orders = lazy(() => import('../pages/orders/Orders'))
const B2COrdersList = lazy(() => import('../components/orders/b2c/B2COrdersList'))
const B2bOrders = lazy(() => import('../pages/orders/B2bOrders'))
const CreateOrderWrapper = lazy(() => import('../components/orders/CreateOrderWrapper'))
const OrderTracking = lazy(() => import('../pages/orders/OrderTracking'))

// Settings
const Settings = lazy(() => import('../pages/settings/Settings'))
const PickupAddresses = lazy(() => import('../pages/pickup-addresses/PickupAddresses'))
const InvoicePreferences = lazy(() => import('../components/settings/InvoicePreference'))
const LabelSettingsPage = lazy(() => import('../components/settings/Label/LabelSettings'))
const UsersManagement = lazy(() => import('../pages/users-management/UsersManagement'))
const CourierPriorityPage = lazy(
  () => import('../components/settings/CourierPriority/CourierPriorityPage'),
)

// Billing
const WalletTransactions = lazy(() => import('../pages/billings/WalletTransactions'))
const Invoices = lazy(() => import('../pages/billings/Invoices'))

// Channels
const Channels = lazy(() => import('../pages/channels/Channels'))
const ChannelList = lazy(() => import('../pages/channels/ChannelList'))

// Policies
const PoliciesLayout = lazy(() => import('../pages/policy/PoliciesLayout'))
const AboutUs = lazy(() => import('../pages/policy/AboutUs'))
const CancellationPolicy = lazy(() => import('../pages/policy/CancellationPolicy'))
const CompanyDetails = lazy(() => import('../pages/policy/CompanyDetails'))
const PrivacyPolicy = lazy(() => import('../pages/policy/PrivacyPolicy'))
const TermsOfService = lazy(() => import('../pages/policy/TermsOfService'))

// Profile
const ProfileLayout = lazy(() => import('../pages/profile/Profile'))
const UserProfileSettings = lazy(() => import('../components/user/UserProfileSettings'))
const CompanyInfoForm = lazy(() => import('../components/user/profile/CompanyInfoForm'))
const BankAccountsSection = lazy(() =>
  import('../components/user/profile/bankAccounts/BankAccountsSection').then((m) => ({
    default: m.BankAccountsSection,
  })),
)
const KycSection = lazy(() => import('../components/user/profile/Kyc/KycSection'))

// Tools
const RateCard = lazy(() => import('../pages/tools/RateCard'))
const RateCalculator = lazy(() =>
  import('../pages/tools/RateCalculator').then((m) => ({ default: m.RateCalculator })),
)
const OrderTrackingForm = lazy(() => import('../pages/tools/OrderTrackingForm'))

// Support
const SupportTicketsPage = lazy(() =>
  import('../pages/support/SupportTicketsPage').then((m) => ({ default: m.SupportTicketsPage })),
)
const TicketDetailsPage = lazy(
  () => import('../pages/support/TicketDetailsPage').then((m) => ({ default: m.TicketDetailsPage })),
)

// Other
const Home = lazy(() => import('../pages/home/Home'))
const Couriers = lazy(() => import('../pages/couriers/Couriers'))
const CodRemittancesList = lazy(() => import('../pages/cod-remittance/CodRemittancesList'))
const KeyboardShortcutsPage = lazy(() => import('../pages/KeyboardShortcutsPage'))
const Reports = lazy(() => import('../pages/reports/Reports'))

// Weight Reconciliation
const WeightReconciliation = lazy(
  () => import('../pages/weight-reconciliation/WeightReconciliation'),
)
const DiscrepancyDetails = lazy(() => import('../pages/weight-reconciliation/DiscrepancyDetails'))
const WeightReconciliationSettings = lazy(
  () => import('../pages/weight-reconciliation/WeightReconciliationSettings'),
)
// Ops (NDR/RTO)
const NdrList = lazy(() => import('../pages/ops/NdrList'))
const RtoList = lazy(() => import('../pages/ops/RtoList'))
// API Integration
const ApiIntegration = lazy(() => import('../pages/settings/ApiIntegration'))

const ROUTE_RELOAD_KEY = 'choicemee-route-asset-reload'

const isRouteAssetError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    message,
  )
}

const reloadOnceForFreshAssets = () => {
  if (typeof window === 'undefined') return
  const alreadyReloaded = window.sessionStorage.getItem(ROUTE_RELOAD_KEY)
  if (alreadyReloaded) return
  window.sessionStorage.setItem(ROUTE_RELOAD_KEY, '1')
  window.location.reload()
}

class RouteErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { hasError: boolean; chunkError: boolean }
> {
  state = { hasError: false, chunkError: false }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, chunkError: isRouteAssetError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isRouteAssetError(error)) {
      reloadOnceForFreshAssets()
      return
    }
    console.error('Route render failed', error, info)
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, chunkError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return <FullScreenLoader />
  }
}

function RouteAssetRecovery() {
  useEffect(() => {
    const clearReloadMarker = window.setTimeout(() => {
      window.sessionStorage.removeItem(ROUTE_RELOAD_KEY)
    }, 2500)

    const handleRejectedImport = (event: PromiseRejectionEvent) => {
      if (isRouteAssetError(event.reason)) reloadOnceForFreshAssets()
    }

    const handleScriptError = (event: ErrorEvent) => {
      if (isRouteAssetError(event.error || event.message)) reloadOnceForFreshAssets()
    }

    window.addEventListener('unhandledrejection', handleRejectedImport)
    window.addEventListener('error', handleScriptError)

    return () => {
      window.clearTimeout(clearReloadMarker)
      window.removeEventListener('unhandledrejection', handleRejectedImport)
      window.removeEventListener('error', handleScriptError)
    }
  }, [])

  return null
}

function isAppChoiceMeeHost() {
  if (typeof window === 'undefined') return false

  return window.location.hostname.toLowerCase().startsWith('app.choicemee')
}

function RootRoute() {
  if (isAppChoiceMeeHost()) return <Navigate to="/login" replace />

  return <LandingPage />
}

function TrackingRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />

  if (isAuthenticated) {
    return <Navigate to={`/tools/order_tracking${location.search || ''}`} replace />
  }

  return <OrderTracking />
}

function RoutedApp() {
  const location = useLocation()
  const routeKey = [location.key, location.pathname, location.search, location.hash]
    .filter(Boolean)
    .join(':')

  return (
    <>
      <NavigationLoader />
      <GlobalRedirectHandler />
      <RouteAssetRecovery />
      <RouteErrorBoundary resetKey={routeKey}>
        <Suspense fallback={<FullScreenLoader />}>
          <Routes location={location} key={routeKey}>
          {/* public */}
          <Route path="/" element={<RootRoute />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/app" element={<AppEntry />} />
          <Route path="/preview" element={<ClientPreview />} />
          <Route path="/tracking" element={<TrackingRoute />} />
          <Route path="/rate-calculator" element={<RateCalculator publicView="rate" />} />
          <Route path="/weight-calculator" element={<RateCalculator publicView="weight" />} />
          <Route path="/terms-and-conditions" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          {/* onboarding */}
          <Route
            path="/onboarding-questions"
            element={
              <RequireOnboard>
                <UserOnboarding />
              </RequireOnboard>
            }
          />
          {/* private layout (requires auth) */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/manage_pickups" element={<PickupAddresses />} />
            <Route path="/billing/wallet_transactions" element={<WalletTransactions />} />
            <Route path="/billing/invoice_management" element={<Invoices />} />
            <Route path="/orders/list" element={<Orders />} />
            <Route
              path="/orders/create"
              element={
                <RequireMerchantReady>
                  <CreateOrderWrapper />
                </RequireMerchantReady>
              }
            />
            <Route path="/orders/b2c/list" element={<B2COrdersList />} />
            <Route path="/support/about_us" element={<AboutUs />} />
            <Route path="/orders/b2b/list" element={<B2bOrders />} />
            <Route path="/settings/invoice_preferences" element={<InvoicePreferences />} />
            <Route path="/settings/label_config" element={<LabelSettingsPage />} />
            <Route path="/settings/users_management" element={<UsersManagement />} />
            <Route path="/settings/courier_priority" element={<CourierPriorityPage />} />
            <Route path="/settings/api-integration" element={<ApiIntegration />} />
            <Route path="/channels/connected" element={<Channels />} />
            <Route path="/channels/channel_list" element={<ChannelList />} />
            <Route path="/policies/*" element={<PoliciesLayout />}>
              <Route path="refund_cancellation" element={<CancellationPolicy />} />
              <Route path="privacy_policy" element={<PrivacyPolicy />} />
              <Route path="terms_of_service" element={<TermsOfService />} />
              <Route path="contact_us" element={<CompanyDetails />} />
            </Route>
            <Route path="/help/shortcuts" element={<KeyboardShortcutsPage />} />
            <Route path="/profile/*" element={<ProfileLayout />}>
              <Route path="user_profile/*" element={<UserProfileSettings />} />
              <Route index element={<Navigate to="user_profile" replace />} />
              <Route path="user_profile" element={<UserProfileSettings />} />
              <Route path="company" element={<CompanyInfoForm />} />
              <Route path="password" element={<UserProfileSettings />} />
              <Route path="bank_details" element={<BankAccountsSection />} />
              <Route path="kyc_details" element={<KycSection />} />
            </Route>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tools/rate_card" element={<RateCard />} />
            <Route path="/tools/rate_calculator" element={<RateCalculator />} />
            <Route path="/tools/order_tracking" element={<OrderTrackingForm />} />
            <Route path="/support/tickets" element={<SupportTicketsPage />} />
            <Route path="/support/tickets/:id" element={<TicketDetailsPage />} />
            <Route path="/home" element={<Home />} />
            <Route path="/couriers/partners" element={<Couriers />} />
            <Route path="/cod-remittance" element={<CodRemittancesList />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reconciliation/weight" element={<WeightReconciliation />} />
            <Route path="/reconciliation/weight/:id" element={<DiscrepancyDetails />} />
            <Route
              path="/reconciliation/weight/settings"
              element={<WeightReconciliationSettings />}
            />
            {/* Ops */}
            <Route path="/ops/ndr" element={<NdrList />} />
            <Route path="/ops/rto" element={<RtoList />} />
          </Route>
          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </>
  )
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <RoutedApp />
    </BrowserRouter>
  )
}
