import { useState } from 'react'
import { useTranslation } from '../i18n'
import api from '../services/api'

export default function ForcePasswordResetPage() {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (newPassword !== newPasswordConfirm) {
      setError(t.auth.passwordResetMismatch)
      return
    }
    if (newPassword.length < 8) {
      setError(t.auth.passwordResetTooShort)
      return
    }

    setLoading(true)
    try {
      await api.post('/users/change_password/', {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      })

      const meResponse = await api.get('/users/me/')
      localStorage.setItem('current_user', JSON.stringify(meResponse.data))
      setMessage(t.auth.passwordResetSuccess)
      window.setTimeout(() => {
        window.location.href = '/cars'
      }, 700)
    } catch (err) {
      const detail = err?.response?.data
      if (detail?.current_password?.[0]) {
        setError(detail.current_password[0])
      } else {
        setError(t.auth.passwordResetError)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">{t.auth.forceResetTitle}</h1>
        <p className="admin-subtitle">{t.auth.forceResetSubtitle}</p>

        <label className="form-label" htmlFor="current-password">{t.auth.currentPassword}</label>
        <input
          id="current-password"
          type="password"
          className="form-input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />

        <label className="form-label" htmlFor="new-password">{t.auth.newPassword}</label>
        <input
          id="new-password"
          type="password"
          className="form-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />

        <label className="form-label" htmlFor="confirm-new-password">{t.auth.confirmNewPassword}</label>
        <input
          id="confirm-new-password"
          type="password"
          className="form-input"
          value={newPasswordConfirm}
          onChange={(e) => setNewPasswordConfirm(e.target.value)}
          required
        />

        {message && <p className="form-success">{message}</p>}
        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
          {loading ? t.pages.loading : t.auth.passwordResetButton}
        </button>
      </form>
    </div>
  )
}
