import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import ScrollToTopButton from './ScrollToTopButton'

export default function Layout() {
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

  return (
    <div className="site-shell">
      <Header />
      <main className="site-main container">
        <Outlet />
      </main>
      <Footer />
      <ScrollToTopButton />
    </div>
  )
}
