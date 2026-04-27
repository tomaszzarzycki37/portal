import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n'
import api from '../services/api'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t.pages.passwordMismatch)
      return
    }

    setLoading(true)

    try {
      await api.post('/users/', {
        username,
        email,
        password,
      })

      // Auto-login after registration
      const tokenResponse = await api.post('/users/token/', { username, password })
      localStorage.setItem('access_token', tokenResponse.data.access)
      localStorage.setItem('refresh_token', tokenResponse.data.refresh)

      const meResponse = await api.get('/users/me/')
      const currentUser = meResponse.data
      localStorage.setItem('current_user', JSON.stringify(currentUser))

      // Redirect to home
      window.location.href = '/'
    } catch (err) {
      setError(t.pages.registerError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">{t.pages.registerTitle}</h1>

        <label className="form-label" htmlFor="username">{t.auth.username}</label>
        <input
          id="username"
          className="form-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label className="form-label" htmlFor="email">{t.pages.registerEmail}</label>
        <input
          id="email"
          type="email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="form-label" htmlFor="password">{t.pages.registerPassword}</label>
        <input
          id="password"
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <label className="form-label" htmlFor="confirmPassword">{t.pages.registerConfirmPassword}</label>
        <input
          id="confirmPassword"
          type="password"
          className="form-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
          {loading ? t.pages.loading : t.pages.registerButton}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          {t.pages.registerAlreadyHave} <Link to="/login" style={{ color: '#f59e0b' }}>Login</Link>
        </p>
      </form>
    </div>
  )
}
