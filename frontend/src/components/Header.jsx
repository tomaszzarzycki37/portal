import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from '../i18n'
import { isAdminUser } from '../utils/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const API_ORIGIN = import.meta.env.VITE_API_URL
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:8000'
    : ''

function resolveBrandLogoSrc(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const token = localStorage.getItem('access_token')
  const isAdmin = isAdminUser()
  const { t, lang, setLang } = useTranslation()
  const brandLogoSrc = resolveBrandLogoSrc(t.nav.brandLogoUrl)
  const hasBrandLogo = Boolean(brandLogoSrc)

  return (
    <header className="site-header">
      <nav className="container header-nav">
        <Link to="/" className="brand-link">
          {hasBrandLogo ? (
            <img src={brandLogoSrc} alt={t.nav.brandTitle} className="brand-logo-image" />
          ) : (
            <span className="brand-logo-mark" aria-hidden="true">{t.nav.brandIcon}</span>
          )}
          <span>{t.nav.brandTitle}</span>
        </Link>
        
        <div className="main-nav desktop-only">
          <Link to="/cars" className="nav-link">{t.nav.cars}</Link>
          <Link to="/opinions" className="nav-link">{t.nav.opinions}</Link>
          <Link to="/reviews" className="nav-link">{t.nav.reviews}</Link>
          {token && <Link to="/profile" className="nav-link">{t.nav.profile}</Link>}
          {token && isAdmin && <Link to="/admin" className="nav-link">{t.nav.admin}</Link>}
        </div>

        <div className="lang-switch desktop-only" aria-label="Language switcher">
          <button
            type="button"
            className={`lang-btn ${lang === 'pl' ? 'active' : ''}`}
            onClick={() => setLang('pl')}
          >
            PL
          </button>
          <button
            type="button"
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
          >
            EN
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

      {isMenuOpen && (
        <div className="mobile-nav-wrap mobile-only">
          <div className="container mobile-nav">
            <div className="lang-switch" aria-label="Language switcher">
              <button
                type="button"
                className={`lang-btn ${lang === 'pl' ? 'active' : ''}`}
                onClick={() => setLang('pl')}
              >
                PL
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                EN
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
            {token && <Link to="/profile" className="nav-link">{t.nav.profile}</Link>}
            {token && isAdmin && <Link to="/admin" className="nav-link">{t.nav.admin}</Link>}
          </div>
        </div>
      )}
    </header>
  )
}
