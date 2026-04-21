import { useState } from 'react'
import { useTranslation } from '../i18n'
import api from '../services/api'

export default function LoginPage() {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const tokenResponse = await api.post('/users/token/', { username, password })
      localStorage.setItem('access_token', tokenResponse.data.access)
      localStorage.setItem('refresh_token', tokenResponse.data.refresh)

      const meResponse = await api.get('/users/me/')
      const currentUser = meResponse.data
      localStorage.setItem('current_user', JSON.stringify(currentUser))

      const isAdmin = !!(currentUser?.is_staff || currentUser?.is_superuser)
      window.location.href = isAdmin ? '/' : '/cars'
    } catch {
      setError(t.auth.invalidCreds)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">{t.auth.loginTitle}</h1>

        <label className="form-label" htmlFor="username">{t.auth.username}</label>
        <input
          id="username"
          className="form-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label className="form-label" htmlFor="password">{t.auth.password}</label>
        <input
          id="password"
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
          {loading ? t.pages.loading : t.auth.loginButton}
        </button>
      </form>
    </div>
  )
}
