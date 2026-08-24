import {
  IconAdjustments,
  IconAlertTriangle,
  IconArrowBackUp,
  IconBell,
  IconCoinRupee,
  IconDashboard,
  IconHelpCircle,
  IconInfoCircle,
  IconKey,
  IconLogin2,
  IconPackageExport,
  IconSettings,
  IconStar,
  IconTools,
  IconTrack,
  IconTruck,
  IconUser,
} from '@tabler/icons-react'
import { FaMoneyBill } from 'react-icons/fa'
import { MdAccountBalanceWallet } from 'react-icons/md'
import { RiScales3Line } from 'react-icons/ri'

// Components
import { lazy, Suspense } from 'react'
import { BsCreditCard2Back } from 'react-icons/bs'
import { CiCalculator1 } from 'react-icons/ci'
import { IoLocation } from 'react-icons/io5'
import { MdGavel } from 'react-icons/md'
import AdminUsersPage from 'views/AdminUsers/AdminUsersPage'
import { AdminRoute } from 'views/Auth/AdminRoute'
import SignIn from 'views/Auth/SignIn'
import AdminBillingInvoices from 'views/Billing/AdminBillingInvoices'
import AdminBillingPreferences from 'views/Billing/AdminBillingPreferences'
import AdminCodRemittancePage from 'views/CodRemittance/AdminCodRemittancePage'
import Couriers from 'views/Couriers/Couriers'
import CourierCredentials from 'views/Couriers/CourierCredentials'
import ServiceProviders from 'views/Couriers/ServiceProviders'
import Dashboard from 'views/Dashboard/Dashboard'
import DeveloperLogs from 'views/Developer/DeveloperLogs'
import ApiIntegration from 'views/Integrations/ApiIntegration'
import AdminNdr from 'views/Ops/AdminNdr'
import AdminRto from 'views/Ops/AdminRto'
import AdminNotificationsPage from 'views/Notifications/AdminNotificationsPage'
import ManualBooking from 'views/Orders/ManualBooking'
import Orders from 'views/Orders/Orders'
import PlanManagement from 'views/PlanManagement/PlanManagement'
import ServiceabilityPage from 'views/Serviceability/ServiceabilityPage'
import PaymentOptionsSettings from 'views/Settings/PaymentOptionsSettings'
import AdminChangePassword from 'views/Settings/AdminChangePassword'
import AboutUsEditor from 'views/Support/AboutUsEditor'
import AdminTicketDashboard from 'views/Support/AdminTicketsDashboard'
import OrderTrackingPage from 'views/Tools/OrderTrackingPage'
import RateCalculatorPage from 'views/Tools/RateCalculatorPage'
import UserDetails from 'views/UsersManagement/UserDetails'
import UsersManagementPage from 'views/UsersManagement/UsersManagementPage'
import AdminWallets from 'views/Wallets/AdminWallets'
import AdminDisputeManagement from 'views/WeightReconciliation/AdminDisputeManagement'
import AdminWeightReconciliationDashboard from 'views/WeightReconciliation/AdminWeightReconciliationDashboard'
import ZoneMappingsPage from 'views/Zones/ZoneMappingsPage'

// Lazy load pricing management pages
const B2BPricingManagement = lazy(() => import('views/Pricing/B2BPricingManagement'))
const B2CPricingManagement = lazy(() => import('views/Pricing/B2CPricingManagement'))
const HolidayManagement = lazy(() => import('views/B2B/HolidayManagement'))

// ------------------ ROUTES ------------------

const dashRoutes = [
  // ========== DASHBOARD ==========
  // Dashboard (home page)
  {
    path: '/dashboard',
    name: 'Dashboard',
    permissionKey: 'dashboard',
    icon: <IconDashboard size={20} />,
    component: () => (
      <AdminRoute>
        <Dashboard />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // ========== CORE OPERATIONS ==========
  // Orders (most frequently used)
  {
    path: '/orders',
    name: 'Orders',
    permissionKey: 'orders',
    icon: <IconPackageExport />,
    component: () => (
      <AdminRoute>
        <Orders />
      </AdminRoute>
    ),
    layout: '/admin',
  },
  {
    path: '/manual-booking',
    name: 'Manual Booking',
    permissionKey: 'manual_booking',
    icon: <IconTruck />,
    component: () => (
      <AdminRoute>
        <ManualBooking />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // Operations (NDR, RTO)
  {
    category: true,
    name: 'Operations',
    state: 'opsCollapse',
    icon: <IconSettings size={20} />,
    layout: '/admin',
    views: [
      {
        path: '/ops/ndr',
        name: 'NDR',
        permissionKey: 'ops_ndr',
        icon: <IconAlertTriangle />,
        component: () => (
          <AdminRoute>
            <AdminNdr />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/ops/rto',
        name: 'RTO',
        permissionKey: 'ops_rto',
        icon: <IconArrowBackUp />,
        component: () => (
          <AdminRoute>
            <AdminRto />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      // Pickups UI removed; cancellation is available from Orders or API
    ],
  },

  // ========== USER & BUSINESS MANAGEMENT ==========
  // Users Management
  {
    path: '/users-management/:id',
    name: 'User Details',
    permissionKey: 'users_management',
    component: () => (
      <AdminRoute>
        <UserDetails />
      </AdminRoute>
    ),
    layout: '/admin',
    show: false,
  },
  {
    path: '/users-management',
    name: 'Users Management',
    permissionKey: 'users_management',
    icon: <IconUser size={20} />,
    component: () => (
      <AdminRoute>
        <UsersManagementPage />
      </AdminRoute>
    ),
    layout: '/admin',
  },
  {
    path: '/admin-users',
    name: 'Admin Users',
    icon: <IconUser size={20} />,
    permissionKey: 'admin_users',
    component: () => (
      <AdminRoute>
        <AdminUsersPage />
      </AdminRoute>
    ),
    layout: '/admin',
  },
  {
    path: '/notifications',
    name: 'Notifications',
    permissionKey: 'notifications',
    icon: <IconBell size={20} />,
    component: () => (
      <AdminRoute>
        <AdminNotificationsPage />
      </AdminRoute>
    ),
    layout: '/admin',
    show: false,
  },

  // Plan Management
  {
    path: '/plans',
    name: 'Plan Management',
    permissionKey: 'plans',
    icon: <IconStar size={19} />,
    component: () => (
      <AdminRoute>
        <PlanManagement />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // ========== SHIPPING & LOGISTICS ==========
  // Shipping Management (Couriers + Rate Card + Serviceability + Zones)
  {
    category: true,
    name: 'Shipping Management',
    state: 'shippingCollapse',
    icon: <IconTruck size={21} />,
    views: [
      {
        path: '/couriers',
        name: 'Couriers',
        permissionKey: 'couriers',
        icon: <IconTruck />,
        component: () => (
          <AdminRoute>
            <Couriers />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/courier-credentials',
        name: 'Courier Credentials',
        permissionKey: 'courier_credentials',
        icon: <IconKey />,
        component: () => (
          <AdminRoute>
            <CourierCredentials />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/service-providers',
        name: 'Service Providers',
        permissionKey: 'service_providers',
        icon: <IconTruck />,
        component: () => (
          <AdminRoute>
            <ServiceProviders />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/zones-mappings/:zoneId',
        name: 'Zone Mappings',
        permissionKey: 'serviceability',
        component: () => (
          <AdminRoute>
            <ZoneMappingsPage />
          </AdminRoute>
        ),
        layout: '/admin',
        show: false,
      },
      {
        path: '/serviceability',
        name: 'Serviceability',
        permissionKey: 'serviceability',
        icon: <IoLocation />,
        component: () => (
          <AdminRoute>
            <ServiceabilityPage />
          </AdminRoute>
        ),
        layout: '/admin',
      },

      {
        path: '/pricing/b2b',
        name: 'B2B',
        permissionKey: 'pricing_b2b',
        icon: <BsCreditCard2Back />,
        component: () => (
          <AdminRoute>
            <Suspense fallback={<div>Loading B2B...</div>}>
              <B2BPricingManagement />
            </Suspense>
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/pricing/b2c',
        name: 'B2C',
        permissionKey: 'pricing_b2c',
        icon: <BsCreditCard2Back />,
        component: () => (
          <AdminRoute>
            <Suspense fallback={<div>Loading B2C...</div>}>
              <B2CPricingManagement />
            </Suspense>
          </AdminRoute>
        ),
        layout: '/admin',
      },
    ],
  },

  // ========== FINANCIAL ==========
  // Billing (Invoices, COD Remittance, Wallet)
  {
    category: true,
    path: '/billing',
    name: 'Billing',
    state: 'billingCollapse',
    icon: <FaMoneyBill />,
    layout: '/admin',
    views: [
      {
        path: '/billing-invoices',
        name: 'Invoices',
        permissionKey: 'billing_invoices',
        icon: <MdAccountBalanceWallet />,
        component: () => (
          <AdminRoute>
            <AdminBillingInvoices />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/billing-preferences',
        name: 'Billing Preferences',
        permissionKey: 'billing_preferences',
        icon: <IconAdjustments />,
        component: () => (
          <AdminRoute>
            <AdminBillingPreferences />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/cod-remittance',
        name: 'COD Remittance',
        permissionKey: 'cod_remittance',
        icon: <MdAccountBalanceWallet />,
        component: () => (
          <AdminRoute>
            <AdminCodRemittancePage />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/wallet',
        name: 'Wallet',
        permissionKey: 'wallets',
        icon: <IconCoinRupee />,
        component: () => (
          <AdminRoute>
            <AdminWallets />
          </AdminRoute>
        ),
        layout: '/admin',
      },
    ],
  },

  // Reconciliation (Weight Discrepancies, Disputes)
  {
    category: true,
    name: 'Reconciliation',
    state: 'reconciliationCollapse',
    icon: <RiScales3Line size={20} />,
    layout: '/admin',
    views: [
      {
        path: '/weight-reconciliation',
        name: 'Weight Discrepancies',
        permissionKey: 'weight_reconciliation',
        icon: <RiScales3Line />,
        component: () => (
          <AdminRoute>
            <AdminWeightReconciliationDashboard />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/dispute-management',
        name: 'Dispute Management',
        permissionKey: 'dispute_management',
        icon: <MdGavel />,
        component: () => (
          <AdminRoute>
            <AdminDisputeManagement />
          </AdminRoute>
        ),
        layout: '/admin',
      },
    ],
  },

  // ========== TOOLS & UTILITIES ==========
  // Tools (Rate Calculator, Order Tracking)
  {
    category: true,
    path: '/tools',
    name: 'Tools',
    state: 'toolsCollapse',
    icon: <IconTools size={20} />,
    layout: '/admin',
    views: [
      {
        path: '/rate-calculator',
        name: 'Rate Calculator',
        permissionKey: 'rate_calculator',
        icon: <CiCalculator1 />,
        component: () => (
          <AdminRoute>
            <RateCalculatorPage />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/order-tracking',
        name: 'Order Tracking',
        permissionKey: 'order_tracking',
        icon: <IconTrack />,
        component: () => (
          <AdminRoute>
            <OrderTrackingPage />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/api-integration',
        name: 'API Integration',
        permissionKey: 'api_integration',
        icon: <IconKey size={20} />,
        component: () => (
          <AdminRoute>
            <ApiIntegration />
          </AdminRoute>
        ),
        layout: '/admin',
      },
    ],
  },

  // ========== CONTENT & SUPPORT ==========
  // Blogs
  // {
  //   category: true,
  //   name: 'Blogs',
  //   state: 'blogsCollapse',
  //   icon: <FaBlog />,
  //   views: [
  //     {
  //       path: '/blogs',
  //       name: 'All Blogs',
  //       icon: <FaBloggerB />,
  //       component: () => (
  //         <AdminRoute>
  //           <Blogs />
  //         </AdminRoute>
  //       ),
  //       layout: '/admin',
  //     },
  //     {
  //       path: '/create-blog',
  //       name: 'Create Blog',
  //       icon: <MdCreate />,
  //       component: () => (
  //         <AdminRoute>
  //           <CreateBlog />
  //         </AdminRoute>
  //       ),
  //       layout: '/admin',
  //     },
  //     {
  //       path: '/create-blog/:id',
  //       name: 'Edit Blog',
  //       component: () => (
  //         <AdminRoute>
  //           <CreateBlog />
  //         </AdminRoute>
  //       ),
  //       layout: '/admin',
  //       show: false,
  //     },
  //   ],
  // },

  // Support
  // Place the more specific route first so it doesn't get shadowed by `/support`
  {
    path: '/about-us',
    name: 'About Us Page',
    permissionKey: 'about_us',
    icon: <IconInfoCircle />,
    component: () => (
      <AdminRoute>
        <AboutUsEditor />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  {
    path: '/support',
    name: 'Support',
    permissionKey: 'support',
    icon: <IconHelpCircle />,
    component: () => (
      <AdminRoute>
        <AdminTicketDashboard />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // ========== SETTINGS ==========
  {
    path: '/settings/payment-options',
    name: 'Payment Options',
    permissionKey: 'payment_options',
    icon: <IconSettings />,
    component: () => (
      <AdminRoute>
        <PaymentOptionsSettings />
      </AdminRoute>
    ),
    layout: '/admin',
  },
  {
    path: '/settings/change-password',
    name: 'Change Password',
    permissionKey: 'change_password',
    icon: <IconKey />,
    component: () => (
      <AdminRoute>
        <AdminChangePassword />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  {
    path: '/developer',
    name: 'Developer',
    permissionKey: 'developer',
    icon: <IconTools size={20} />,
    component: () => (
      <AdminRoute>
        <DeveloperLogs />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // ========== AUTH ==========
  // Auth (hidden from sidebar)
  {
    path: '/signin',
    name: 'Sign In',
    icon: <IconLogin2 />,
    component: SignIn,
    layout: '/auth',
    show: false,
  },
]

export default dashRoutes
