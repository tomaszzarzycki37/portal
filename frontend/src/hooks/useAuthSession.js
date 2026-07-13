import { useCallback, useEffect, useState } from 'react'
import api from '../services/api'
import {
  AUTH_SESSION_CHANGED_EVENT,
  getCurrentUser,
  isAuthenticatedUser,
  notifyAuthSessionChanged,
} from '../utils/auth'

function computeCanContribute(user) {
  if (!user) return false
  if (user.is_staff || user.is_superuser) return true
  return !!user.profile?.is_approved
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
        if (!cancelled) {
          applyUser(response.data)
        }
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
