let accessToken = ''
let refreshToken = ''
let userId = ''
let keepSignedIn = true

const ACCESS_KEY = 'accessToken'
const REFRESH_KEY = 'refreshToken'
const USER_ID_KEY = 'userId'

const getStoredAuthState = () => {
  const sessionAccessToken = sessionStorage.getItem(ACCESS_KEY) || ''
  const sessionRefreshToken = sessionStorage.getItem(REFRESH_KEY) || ''
  const sessionUserId = sessionStorage.getItem(USER_ID_KEY) || ''

  if (sessionAccessToken || sessionRefreshToken || sessionUserId) {
    keepSignedIn = false
    return {
      accessToken: sessionAccessToken,
      refreshToken: sessionRefreshToken,
      userId: sessionUserId,
    }
  }

  const localAccessToken = localStorage.getItem(ACCESS_KEY) || ''
  const localRefreshToken = localStorage.getItem(REFRESH_KEY) || ''
  const localUserId = localStorage.getItem(USER_ID_KEY) || ''

  if (localAccessToken || localRefreshToken || localUserId) {
    keepSignedIn = true
    return {
      accessToken: localAccessToken,
      refreshToken: localRefreshToken,
      userId: localUserId,
    }
  }

  return {
    accessToken: '',
    refreshToken: '',
    userId: '',
  }
}

export const getAuthPersistence = () => keepSignedIn

export const getStoredAdminAuth = () => {
  if (accessToken || refreshToken || userId) {
    return { accessToken, refreshToken, userId }
  }

  const storedAuth = getStoredAuthState()
  accessToken = storedAuth.accessToken
  refreshToken = storedAuth.refreshToken
  userId = storedAuth.userId

  return storedAuth
}

export const setStoredAdminAuth = (
  nextAccessToken,
  nextRefreshToken,
  nextUserId,
  persist = getAuthPersistence(),
) => {
  accessToken = nextAccessToken || ''
  refreshToken = nextRefreshToken || ''
  userId = nextUserId ? String(nextUserId) : ''
  keepSignedIn = persist

  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  sessionStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_ID_KEY)

  const storage = persist ? localStorage : sessionStorage
  storage.setItem(ACCESS_KEY, accessToken)
  storage.setItem(REFRESH_KEY, refreshToken)

  if (userId) {
    storage.setItem(USER_ID_KEY, userId)
  }
}

export const clearStoredAdminAuth = () => {
  accessToken = ''
  refreshToken = ''
  userId = ''
  keepSignedIn = true

  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  sessionStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_ID_KEY)
}
