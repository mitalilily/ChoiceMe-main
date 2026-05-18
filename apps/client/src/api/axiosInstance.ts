// src/api/axiosInstance.ts
import axios from 'axios'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from './tokenVault'

const RAW_API_BASE_URL = import.meta.env.VITE_API_URL
const DEFAULT_API_BASE_URL = 'https://api.choicemee.in/api'

const getApiBaseUrl = () => {
  const fallback = DEFAULT_API_BASE_URL.replace(/\/+$/, '')

  try {
    if (!RAW_API_BASE_URL) return fallback

    const candidate = new URL(RAW_API_BASE_URL, window.location.origin)
    const currentHost = window.location.hostname
    const isHostedFrontend =
      currentHost.endsWith('netlify.app') ||
      currentHost.endsWith('vercel.app') ||
      currentHost.endsWith('up.railway.app')
    const isLocalhost =
      currentHost === 'localhost' ||
      currentHost === '127.0.0.1' ||
      currentHost === '0.0.0.0'
    const pointsBackToFrontend = candidate.hostname === currentHost

    // In preview/prod frontend hosting, sending API calls back to the same
    // frontend origin often causes 405s on POST auth routes like request-otp.
    if (pointsBackToFrontend && (isHostedFrontend || !isLocalhost)) {
      return fallback
    }

    const normalized = candidate.href.replace(/\/+$/, '')
    if (normalized.endsWith('/api') || normalized.includes('/api/')) return normalized
    return `${normalized}/api`
  } catch {
    return fallback
  }
}

const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null

const redirectToLogin = () => {
  if (!window.location.pathname.includes('/login')) {
    window.location.replace('/login')
  }
}

const refreshAuthTokens = (refreshToken: string) => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh-token`,
        { refreshToken },
        {
          headers: {
            'x-refresh-token': refreshToken,
          },
        },
      )
      .then(({ data }) => {
        if (!data?.accessToken || !data?.refreshToken) {
          throw new Error('Invalid response from refresh token endpoint')
        }

        setAuthTokens(data.accessToken, data.refreshToken)
        return data
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

api.interceptors.request.use((cfg) => {
  const { accessToken } = getAuthTokens()
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`

  if (typeof FormData !== 'undefined' && cfg.data instanceof FormData && cfg.headers) {
    const headers = cfg.headers as { delete?: (name: string) => void; [key: string]: unknown }
    if (typeof headers.delete === 'function') {
      headers.delete('Content-Type')
    } else {
      delete headers['Content-Type']
    }
  }

  return cfg
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const requestUrl = original?.url || ''

    if (
      err.response?.status !== 401 ||
      !original ||
      original._retry ||
      requestUrl.includes('/auth/')
    ) {
      return Promise.reject(err)
    }

    original._retry = true

    const { refreshToken } = getAuthTokens()
    if (!refreshToken) {
      clearAuthTokens()
      redirectToLogin()
      return Promise.reject(err)
    }

    try {
      const data = await refreshAuthTokens(refreshToken)
      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (e) {
      clearAuthTokens()
      redirectToLogin()
      return Promise.reject(e)
    }
  },
)

export default api
