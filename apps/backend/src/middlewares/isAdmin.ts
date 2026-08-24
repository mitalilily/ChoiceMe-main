// src/middlewares/isAdminMiddleware.ts
import { eq } from 'drizzle-orm'
import { NextFunction, Response } from 'express'
import { db } from '../models/client'
import { employees, users } from '../schema/schema'

const ADMIN_PERMISSION_PREFIXES: Array<[string, string]> = [
  ['/api/admin/dashboard', 'dashboard'],
  ['/api/admin/orders/manual-booking', 'manual_booking'],
  ['/api/admin/orders', 'orders'],
  ['/api/admin/users/employees', 'admin_users'],
  ['/api/admin/users', 'users_management'],
  ['/api/admin/couriers/providers', 'service_providers'],
  ['/api/admin/couriers', 'couriers'],
  ['/api/admin/zones', 'serviceability'],
  ['/api/admin/b2b', 'pricing_b2b'],
  ['/api/admin/billing-preferences', 'billing_preferences'],
  ['/api/admin/billing', 'billing_invoices'],
  ['/api/admin/cod-remittance', 'cod_remittance'],
  ['/api/admin/wallets', 'wallets'],
  ['/api/admin/payment-options', 'payment_options'],
  ['/api/admin/weight-reconciliation', 'weight_reconciliation'],
  ['/api/admin/ndr', 'ops_ndr'],
  ['/api/admin/rto', 'ops_rto'],
  ['/api/admin/support', 'support'],
  ['/api/admin/developer', 'developer'],
  ['/api/static-pages', 'about_us'],
]

const getPermissionKeyForRequest = (originalUrl = '') => {
  const path = originalUrl.split('?')[0]
  if (path === '/api/admin/users/employees/me') return null
  const match = ADMIN_PERMISSION_PREFIXES.find(([prefix]) => path.startsWith(prefix))
  return match?.[1] || null
}

const parseModuleAccess = (raw: unknown): Record<string, any> => {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, any>) : {}
}

const hasRequiredAccess = (moduleAccess: Record<string, any>, key: string | null, method: string) => {
  if (!key) return true
  const access = moduleAccess[key]
  if (access === true) return true
  if (!access || typeof access !== 'object') return false
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return Boolean(access.read || access.edit)
  }
  return Boolean(access.edit)
}

export const isAdminMiddleware = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.sub

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user ID found' })
    }

    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))

    if (!user || !['admin', 'employee'].includes(String(user.role || ''))) {
      return res.status(403).json({ message: 'Forbidden: Admin access only' })
    }

    if (user.role === 'employee') {
      const [employee] = await db
        .select({
          isActive: employees.isActive,
          moduleAccess: employees.moduleAccess,
        })
        .from(employees)
        .where(eq(employees.userId, userId))
        .limit(1)

      if (!employee?.isActive) {
        return res.status(403).json({ message: 'Your employee account is inactive' })
      }

      const permissionKey = getPermissionKeyForRequest(req.originalUrl || req.url)
      if (!hasRequiredAccess(parseModuleAccess(employee.moduleAccess), permissionKey, req.method)) {
        return res.status(403).json({ message: 'You do not have permission for this action' })
      }
    }

    next()
  } catch (error) {
    console.error('[isAdminMiddleware]', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
