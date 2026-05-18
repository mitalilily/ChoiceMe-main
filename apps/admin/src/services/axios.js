import axios from 'axios'

const isLocalhost =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (isLocalhost ? 'http://127.0.0.1:5002/api' : 'https://api.choicemee.in/api')

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
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('userId')
}

const updateAuthStore = async (accessToken, refreshToken) => {
  const { useAuthStore } = await import('../store/useAuthStore')
  const userId = localStorage.getItem('userId')
  useAuthStore.getState().login(accessToken, userId, refreshToken)
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

        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
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
  const token = localStorage.getItem('accessToken')
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

    const refreshToken = localStorage.getItem('refreshToken')
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
