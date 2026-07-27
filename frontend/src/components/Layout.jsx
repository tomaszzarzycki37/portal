import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import ScrollToTopButton from './ScrollToTopButton'
import UserActivityHeartbeat from './UserActivityHeartbeat'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { isPortalOwner } from '../utils/auth'

export default function Layout() {
  const { t } = useTranslation()
  const [maintenanceMode, setMaintenanceMode] = useState(false)

  useEffect(() => {
    const darkClass = 'app-theme-dark'

    const applyTheme = (mode) => {
      const isDark = mode === 'dark'
      document.body.classList.toggle(darkClass, isDark)
    }

    const readTheme = () => localStorage.getItem('admin_theme_mode') || 'light'

    applyTheme(readTheme())

    const handleStorage = (event) => {
      if (event.key === 'admin_theme_mode') applyTheme(event.newValue || 'light')
    }

    const handleThemeChange = (event) => {
      applyTheme(event?.detail || readTheme())
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('theme-mode-changed', handleThemeChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('theme-mode-changed', handleThemeChange)
      document.body.classList.remove(darkClass)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadStatus = async () => {
      try {
        const response = await api.get('/common/site-status/')
        if (!cancelled) {
          setMaintenanceMode(!!response.data?.maintenance_mode)
        }
      } catch {
        if (!cancelled) setMaintenanceMode(false)
      }
    }
    loadStatus()
    const timer = window.setInterval(loadStatus, 60000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const showMaintenanceBanner = maintenanceMode && !isPortalOwner()

  return (
    <div className="site-shell">
      <Header />
      {showMaintenanceBanner && (
        <div
          style={{
            background: '#7c2d12',
            color: '#fff7ed',
            textAlign: 'center',
            padding: '0.65rem 1rem',
            fontWeight: 600,
          }}
        >
          {t.pages.maintenanceBanner}
        </div>
      )}
      <main className="site-main container">
        <Outlet />
      </main>
      <Footer />
      <ScrollToTopButton />
      <UserActivityHeartbeat />
    </div>
  )
}
