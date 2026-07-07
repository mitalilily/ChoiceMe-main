// store/useAuthStore.js
import { jwtDecode } from 'jwt-decode'
import { create } from 'zustand'
import { clearStoredAdminAuth, getStoredAdminAuth, setStoredAdminAuth } from '../services/authStorage'

function isTokenExpired(token) {
  try {
    const decoded = jwtDecode(token)
    return decoded.exp < Date.now() / 1000
  } catch (err) {
    return true // treat invalid/undecodable token as expired
  }
}

export const useAuthStore = create((set) => {
  const { accessToken, refreshToken, userId } = getStoredAdminAuth()

  const isRefreshValid = refreshToken && !isTokenExpired(refreshToken)

  if (!isRefreshValid) {
    clearStoredAdminAuth()
  }

  return {
    token: isRefreshValid ? accessToken : null,
    refreshToken: isRefreshValid ? refreshToken : null,
    userId: isRefreshValid ? userId : null,
    isLoggedIn: isRefreshValid && !!accessToken,

    login: (token, userId, refreshToken, persist) => {
      setStoredAdminAuth(token, refreshToken, userId, persist)

      set({
        token,
        refreshToken,
        userId,
        isLoggedIn: true,
      })
    },

    logout: () => {
      clearStoredAdminAuth()
      set({
        token: null,
        refreshToken: null,
        userId: null,
        isLoggedIn: false,
      })
    },
  }
})
