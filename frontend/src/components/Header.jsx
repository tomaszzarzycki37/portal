import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { isAdminUser } from '../utils/auth'
import api from '../services/api'
import { normalizeMediaUrl } from '../utils/mediaUrl'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const API_ORIGIN = import.meta.env.VITE_API_URL
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:8000'
    : ''

function resolveBrandLogoSrc(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return normalizeMediaUrl(url)
  if (url.startsWith('/')) return normalizeMediaUrl(`${API_ORIGIN}${url}`)
  return normalizeMediaUrl(`${API_ORIGIN}/${url}`)
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('admin_theme_mode') || 'light')
  const [brandTagline, setBrandTagline] = useState('')
  const token = localStorage.getItem('access_token')
  const isAdmin = isAdminUser()
  const { t, lang, setLang } = useTranslation()
  const brandLogoSrc = resolveBrandLogoSrc(t.nav.brandLogoUrl)
  const hasBrandLogo = Boolean(brandLogoSrc)

  useEffect(() => {
    const fetchBrandTagline = async () => {
      try {
        const response = await api.get(`/common/content/?lang=${lang}&key=nav.brandTagline`)
        const list = response.data.results || response.data || []
        const taglineRecord = list.find((item) => item.key === 'nav.brandTagline')
        if (taglineRecord && taglineRecord.value) {
          setBrandTagline(taglineRecord.value)
        } else {
          setBrandTagline(t.nav.brandTagline || '')
        }
      } catch {
        setBrandTagline(t.nav.brandTagline || '')
      }
    }

    fetchBrandTagline()
  }, [lang, t.nav.brandTagline])

  useEffect(() => {
    const syncBodyThemeClass = (mode) => {
      document.body.classList.toggle('app-theme-dark', mode === 'dark')
    }

    const readTheme = () => localStorage.getItem('admin_theme_mode') || 'light'
    const syncTheme = (nextMode) => {
      const resolvedMode = nextMode || readTheme()
      setThemeMode(resolvedMode)
      syncBodyThemeClass(resolvedMode)
    }

    const handleStorage = (event) => {
      if (event.key === 'admin_theme_mode') syncTheme(event.newValue)
    }

    const handleThemeChange = (event) => syncTheme(event?.detail)

    syncTheme(readTheme())
    window.addEventListener('storage', handleStorage)
    window.addEventListener('theme-mode-changed', handleThemeChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('theme-mode-changed', handleThemeChange)
    }
  }, [])

  const applyThemeMode = (nextMode) => {
    setThemeMode(nextMode)
    document.body.classList.toggle('app-theme-dark', nextMode === 'dark')
    localStorage.setItem('admin_theme_mode', nextMode)
    window.dispatchEvent(new CustomEvent('theme-mode-changed', { detail: nextMode }))
  }

  return (
    <header className="site-header">
      <nav className="container header-nav">
        <div className="brand-section">
          <Link to="/" className="brand-link">
            {hasBrandLogo ? (
              <img src={brandLogoSrc} alt={t.nav.brandTitle} className="brand-logo-image" />
            ) : (
              <span className="brand-logo-mark" aria-hidden="true">{t.nav.brandIcon}</span>
            )}
            <span>{t.nav.brandTitle}</span>
          </Link>
        </div>
        
        <div className="main-nav desktop-only">
          <Link to="/cars" className="nav-link">{t.nav.cars}</Link>
          <Link to="/opinions" className="nav-link">{t.nav.opinions}</Link>
          <Link to="/reviews" className="nav-link">{t.nav.reviews}</Link>
          {token && <Link to="/my-content" className="nav-link">{t.nav.myContent}</Link>}
          {token && <Link to="/profile" className="nav-link">{t.nav.profile}</Link>}
          {token && isAdmin && <Link to="/admin" className="nav-link">{t.nav.admin}</Link>}
        </div>

        <div className="lang-switch desktop-only" aria-label="Language switcher">
          <button
            type="button"
            className={`lang-btn language-toggle-btn ${lang === 'pl' ? 'active' : ''}`}
            onClick={() => setLang('pl')}
          >
            PL
          </button>
          <button
            type="button"
            className={`lang-btn language-toggle-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>

        <div className="lang-switch desktop-only" aria-label="Theme switcher">
          <button
            type="button"
            className={`lang-btn theme-toggle-btn ${themeMode === 'light' ? 'active' : ''}`}
            onClick={() => applyThemeMode('light')}
            aria-label={t.nav.themeLight}
            title={t.nav.themeLight}
            aria-pressed={themeMode === 'light'}
          >
            <span aria-hidden="true">☀️</span>
          </button>
          <button
            type="button"
            className={`lang-btn theme-toggle-btn ${themeMode === 'dark' ? 'active' : ''}`}
            onClick={() => applyThemeMode('dark')}
            aria-label={t.nav.themeDark}
            title={t.nav.themeDark}
            aria-pressed={themeMode === 'dark'}
          >
            <span aria-hidden="true">🌙</span>
          </button>
        </div>

        <div className="auth-actions">
          {!token ? (
            <>
              <Link to="/login" className="btn btn-secondary">{t.nav.login}</Link>
              <Link to="/register" className="btn btn-primary">{t.nav.register}</Link>
            </>
          ) : (
            <>
              <span className={`role-badge ${isAdmin ? 'admin' : 'user'}`}>
                {isAdmin ? t.nav.roleAdmin : t.nav.roleUser}
              </span>
              <button onClick={() => {
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                localStorage.removeItem('current_user')
                window.location.href = '/'
              }} className="btn btn-secondary">
                {t.nav.logout}
              </button>
            </>
          )}
        </div>

        <button 
          type="button"
          className="menu-toggle mobile-only"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? t.nav.closeMenu : t.nav.menu}
          title={isMenuOpen ? t.nav.closeMenu : t.nav.menu}
        >
          <svg className="menu-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
            {isMenuOpen ? (
              <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z" />
            ) : (
              <path d="M4 7.5h16v2H4v-2Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
            )}
          </svg>
        </button>
      </nav>

      {brandTagline && (
        <div className="header-tagline-section">
          <div className="container">
            <p className="brand-tagline">{brandTagline}</p>
          </div>
        </div>
      )}

      {isMenuOpen && (
        <div className="mobile-nav-wrap mobile-only">
          <div className="container mobile-nav">
            <div className="lang-switch" aria-label="Language switcher">
              <button
                type="button"
                className={`lang-btn language-toggle-btn ${lang === 'pl' ? 'active' : ''}`}
                onClick={() => setLang('pl')}
              >
                PL
              </button>
              <button
                type="button"
                className={`lang-btn language-toggle-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>
            <div className="lang-switch" aria-label="Theme switcher">
              <button
                type="button"
                className={`lang-btn ${themeMode === 'light' ? 'active' : ''}`}
                onClick={() => applyThemeMode('light')}
                aria-label={t.nav.themeLight}
                title={t.nav.themeLight}
              >
                <span aria-hidden="true">☀️</span>
              </button>
              <button
                type="button"
                className={`lang-btn ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => applyThemeMode('dark')}
                aria-label={t.nav.themeDark}
                title={t.nav.themeDark}
              >
                <span aria-hidden="true">🌙</span>
              </button>
            </div>
            {token && (
              <span className={`role-badge ${isAdmin ? 'admin' : 'user'}`}>
                {isAdmin ? t.nav.roleAdmin : t.nav.roleUser}
              </span>
            )}
            <Link to="/cars" className="nav-link">{t.nav.cars}</Link>
            <Link to="/opinions" className="nav-link">{t.nav.opinions}</Link>
            <Link to="/reviews" className="nav-link">{t.nav.reviews}</Link>
            {token && <Link to="/my-content" className="nav-link">{t.nav.myContent}</Link>}
            {token && <Link to="/profile" className="nav-link">{t.nav.profile}</Link>}
            {token && isAdmin && <Link to="/admin" className="nav-link">{t.nav.admin}</Link>}
          </div>
        </div>
      )}
    </header>
  )
}
