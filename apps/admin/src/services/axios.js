import axios from 'axios'
import {
  clearStoredAdminAuth,
  getAuthPersistence,
  getStoredAdminAuth,
  setStoredAdminAuth,
} from './authStorage'

const isLocalhost =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)

const DEFAULT_API_BASE_URL = isLocalhost
  ? 'http://127.0.0.1:5002/api'
  : 'https://api.choicemee.in/api'
const LEGACY_RAILWAY_API_HOST = 'choiceme-backend-production.up.railway.app'

const normalizeApiBaseUrl = (rawBaseUrl) => {
  if (!rawBaseUrl) return DEFAULT_API_BASE_URL

  try {
    const candidate = new URL(rawBaseUrl)
    if (candidate.hostname === LEGACY_RAILWAY_API_HOST) {
      return DEFAULT_API_BASE_URL
    }

    const normalized = candidate.href.replace(/\/+$/, '')
    if (normalized.endsWith('/api') || normalized.includes('/api/')) return normalized
    return `${normalized}/api`
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.REACT_APP_API_BASE_URL)

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

let refreshPromise = null

const redirectToSignIn = () => {
  if (window.location.pathname !== '/auth/signin') {
    window.location.replace('/auth/signin')
  }
}

const clearStoredAuth = () => {
  clearStoredAdminAuth()
}

const updateAuthStore = async (accessToken, refreshToken) => {
  const { useAuthStore } = await import('../store/useAuthStore')
  const { userId } = getStoredAdminAuth()
  useAuthStore.getState().login(accessToken, userId, refreshToken, getAuthPersistence())
}

const refreshAuthTokens = (refreshToken) => {
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
      .then(async ({ data }) => {
        if (!data?.accessToken || !data?.refreshToken) {
          throw new Error('Invalid response from refresh token endpoint')
        }

        const { userId } = getStoredAdminAuth()
        setStoredAdminAuth(data.accessToken, data.refreshToken, userId, getAuthPersistence())
        await updateAuthStore(data.accessToken, data.refreshToken)
        return data
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

api.interceptors.request.use((config) => {
  const { accessToken } = getStoredAdminAuth()
  const token = accessToken
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const requestUrl = originalRequest?.url || ''

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      requestUrl.includes('/auth/')
    ) {
      return Promise.reject(error)
    }

    const { refreshToken } = getStoredAdminAuth()
    if (!refreshToken) {
      clearStoredAuth()
      redirectToSignIn()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const data = await refreshAuthTokens(refreshToken)
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
      return api(originalRequest)
    } catch (refreshErr) {
      clearStoredAuth()
      const { useAuthStore } = await import('../store/useAuthStore')
      useAuthStore.getState().logout()
      redirectToSignIn()
      return Promise.reject(refreshErr)
    }
  },
)

export default api
