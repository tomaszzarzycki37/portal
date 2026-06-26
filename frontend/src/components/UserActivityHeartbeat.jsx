import { useEffect, useRef } from 'react'
import api from '../services/api'
import { AUTH_SESSION_CHANGED_EVENT, isAuthenticatedUser } from '../utils/auth'

const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000
const MIN_HEARTBEAT_GAP_MS = 30 * 1000

export default function UserActivityHeartbeat() {
  const lastSentRef = useRef(0)
  const inflightRef = useRef(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    const clearHeartbeatInterval = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const sendHeartbeat = async ({ force = false } = {}) => {
      if (!isAuthenticatedUser()) return
      if (document.visibilityState !== 'visible') return

      const now = Date.now()
      if (!force && now - lastSentRef.current < MIN_HEARTBEAT_GAP_MS) return
      if (inflightRef.current) return

      inflightRef.current = true
      try {
        await api.post('/users/heartbeat/')
        lastSentRef.current = Date.now()
      } catch {
        // 401 and network errors are handled elsewhere or can be ignored here.
      } finally {
        inflightRef.current = false
      }
    }

    const startHeartbeat = () => {
      clearHeartbeatInterval()
      if (!isAuthenticatedUser()) return

      sendHeartbeat({ force: true })
      intervalRef.current = window.setInterval(() => {
        sendHeartbeat()
      }, HEARTBEAT_INTERVAL_MS)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat({ force: true })
      }
    }

    startHeartbeat()
    window.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, startHeartbeat)

    return () => {
      clearHeartbeatInterval()
      window.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, startHeartbeat)
    }
  }, [])

  return null
}
