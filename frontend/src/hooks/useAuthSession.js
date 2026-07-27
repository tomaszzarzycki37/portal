import { useCallback, useEffect, useState } from 'react'
import api from '../services/api'
import {
  AUTH_SESSION_CHANGED_EVENT,
  getCurrentUser,
  isAuthenticatedUser,
  isPortalOwner,
  notifyAuthSessionChanged,
} from '../utils/auth'

function computeCanContribute(user) {
  if (!user) return false
  if (user.is_staff || user.is_superuser) return true
  return !!user.profile?.is_approved
}

function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('current_user')
  localStorage.removeItem('session_started_at')
  notifyAuthSessionChanged()
}

export function useAuthSession() {
  const [user, setUser] = useState(() => getCurrentUser())
  const [syncing, setSyncing] = useState(false)

  const applyUser = useCallback((nextUser) => {
    if (nextUser) {
      localStorage.setItem('current_user', JSON.stringify(nextUser))
    } else {
      localStorage.removeItem('current_user')
    }
    setUser(nextUser)
  }, [])

  useEffect(() => {
    let cancelled = false

    const syncUser = async () => {
      if (!isAuthenticatedUser()) {
        applyUser(null)
        return
      }

      setSyncing(true)
      try {
        const response = await api.get('/users/me/')
        if (cancelled) return

        const nextUser = response.data
        const forceLogoutBefore = nextUser?.force_logout_before
        const sessionStartedAt = localStorage.getItem('session_started_at')
        const isOwner = !!(nextUser?.is_portal_owner
          || String(nextUser?.username || '').toLowerCase() === 'toza')

        if (
          forceLogoutBefore
          && sessionStartedAt
          && !isOwner
          && new Date(sessionStartedAt).getTime() < new Date(forceLogoutBefore).getTime()
        ) {
          clearSession()
          applyUser(null)
          window.location.href = '/login'
          return
        }

        applyUser(nextUser)
      } catch {
        if (!cancelled) {
          setUser(getCurrentUser())
        }
      } finally {
        if (!cancelled) {
          setSyncing(false)
        }
      }
    }

    syncUser()

    const onAuthChanged = () => {
      setUser(getCurrentUser())
    }

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged)
    return () => {
      cancelled = true
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged)
    }
  }, [applyUser])

  const isLoggedIn = isAuthenticatedUser()
  const canContribute = computeCanContribute(user)

  return {
    user,
    isLoggedIn,
    canContribute,
    syncing,
    isAdmin: !!(user?.is_staff || user?.is_superuser),
    isOwner: isPortalOwner(),
  }
}

export async function refreshCurrentUser() {
  if (!isAuthenticatedUser()) {
    localStorage.removeItem('current_user')
    notifyAuthSessionChanged()
    return null
  }

  const response = await api.get('/users/me/')
  localStorage.setItem('current_user', JSON.stringify(response.data))
  notifyAuthSessionChanged()
  return response.data
}
