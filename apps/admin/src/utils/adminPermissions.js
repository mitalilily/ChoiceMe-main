export const ADMIN_PERMISSION_PAGES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Core' },
  { key: 'orders', label: 'Orders', group: 'Core' },
  { key: 'manual_booking', label: 'Manual Booking', group: 'Core' },
  { key: 'ops_ndr', label: 'NDR', group: 'Operations' },
  { key: 'ops_rto', label: 'RTO', group: 'Operations' },
  { key: 'users_management', label: 'Users Management', group: 'Users' },
  { key: 'admin_users', label: 'Admin Users', group: 'Users' },
  { key: 'notifications', label: 'Notifications', group: 'Users' },
  { key: 'plans', label: 'Plan Management', group: 'Users' },
  { key: 'couriers', label: 'Couriers', group: 'Shipping' },
  { key: 'courier_credentials', label: 'Courier Credentials', group: 'Shipping' },
  { key: 'service_providers', label: 'Service Providers', group: 'Shipping' },
  { key: 'serviceability', label: 'Serviceability', group: 'Shipping' },
  { key: 'pricing_b2b', label: 'B2B Pricing', group: 'Shipping' },
  { key: 'pricing_b2c', label: 'B2C Pricing', group: 'Shipping' },
  { key: 'billing_invoices', label: 'Billing Invoices', group: 'Billing' },
  { key: 'billing_preferences', label: 'Billing Preferences', group: 'Billing' },
  { key: 'cod_remittance', label: 'COD Remittance', group: 'Billing' },
  { key: 'wallets', label: 'Wallet', group: 'Billing' },
  { key: 'weight_reconciliation', label: 'Weight Reconciliation', group: 'Reconciliation' },
  { key: 'dispute_management', label: 'Dispute Management', group: 'Reconciliation' },
  { key: 'rate_calculator', label: 'Rate Calculator', group: 'Tools' },
  { key: 'order_tracking', label: 'Order Tracking', group: 'Tools' },
  { key: 'api_integration', label: 'API Integration', group: 'Tools' },
  { key: 'about_us', label: 'About Us Page', group: 'Support' },
  { key: 'support', label: 'Support', group: 'Support' },
  { key: 'payment_options', label: 'Payment Options', group: 'Settings' },
  { key: 'change_password', label: 'Change Password', group: 'Settings' },
  { key: 'developer', label: 'Developer', group: 'Settings' },
]

export const canReadPermission = (access, key) => {
  if (!access || !key || access?.isSuperAdmin) return true
  const permission = access?.moduleAccess?.[key]
  return Boolean(permission?.read || permission?.edit)
}

export const canEditPermission = (access, key) => {
  if (!access || !key || access?.isSuperAdmin) return true
  return Boolean(access?.moduleAccess?.[key]?.edit)
}

export const filterRoutesByAccess = (routes, access) =>
  routes
    .map((route) => {
      if (route.category && route.views) {
        const views = filterRoutesByAccess(route.views, access)
        return views.length ? { ...route, views } : null
      }
      return canReadPermission(access, route.permissionKey) ? route : null
    })
    .filter(Boolean)
