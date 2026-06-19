import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { isAdminUser } from '../utils/auth'
import api from '../services/api'

export default function Footer() {
  const { t, lang } = useTranslation()
  const currentYear = new Date().getFullYear()
  const isAdmin = isAdminUser()
  const [textOverrides, setTextOverrides] = useState({})
  const [textRecordIds, setTextRecordIds] = useState({})
  const [editorField, setEditorField] = useState('')
  const [editorValue, setEditorValue] = useState('')
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorMessage, setEditorMessage] = useState('')
  const [editorError, setEditorError] = useState('')

  useEffect(() => {
    const loadFooterOverrides = async () => {
      try {
        const response = await api.get(`/common/content/?lang=${lang}`)
        const rows = response.data.results || response.data || []
        const keys = ['footer.aboutText', 'footer.email', 'footer.phone']

        const nextOverrides = {}
        const nextIds = {}
        keys.forEach((key) => {
          const row = rows.find((item) => item.key === key)
          if (row && String(row.value || '').trim()) {
            nextOverrides[key] = String(row.value)
          }
          if (row?.id) {
            nextIds[key] = row.id
          }
        })

        setTextOverrides(nextOverrides)
        setTextRecordIds(nextIds)
      } catch {
        setTextOverrides({})
        setTextRecordIds({})
      }
    }

    loadFooterOverrides()
  }, [lang])

  const resolveText = (key, fallbackValue) => textOverrides[key] || fallbackValue

  const openEditor = (key, fallbackValue) => {
    if (!isAdmin) return
    setEditorField(key)
    setEditorValue(resolveText(key, fallbackValue))
    setEditorMessage('')
    setEditorError('')
  }

  const closeEditor = () => {
    setEditorField('')
    setEditorValue('')
    setEditorMessage('')
    setEditorError('')
  }

  const handleSaveText = async () => {
    if (!isAdmin || !editorField) return

    const normalizedValue = String(editorValue || '').trim()
    if (!normalizedValue) {
      setEditorError(t.adminInline.saveError)
      return
    }

    try {
      setEditorSaving(true)
      setEditorMessage('')
      setEditorError('')

      const payload = {
        key: editorField,
        lang,
        value: normalizedValue,
      }

      const existingId = textRecordIds[editorField]
      if (existingId) {
        await api.patch(`/common/content/${existingId}/`, payload)
      } else {
        const createResponse = await api.post('/common/content/', payload)
        const createdId = createResponse.data?.id
        if (createdId) {
          setTextRecordIds((prev) => ({ ...prev, [editorField]: createdId }))
        }
      }

      setTextOverrides((prev) => ({ ...prev, [editorField]: normalizedValue }))
      setEditorMessage(t.adminInline.saved)
      closeEditor()
    } catch {
      setEditorError(t.adminInline.saveError)
    } finally {
      setEditorSaving(false)
    }
  }

  const aboutText = resolveText('footer.aboutText', t.footer.aboutText)
  const contactEmail = resolveText('footer.email', t.footer.email)
  const contactPhone = resolveText('footer.phone', t.footer.phone)

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h3 className="footer-title">{t.footer.about}</h3>
          <p
            className={`footer-muted ${isAdmin ? 'review-inline-editable-block' : ''}`}
            role={isAdmin ? 'button' : undefined}
            tabIndex={isAdmin ? 0 : undefined}
            onClick={isAdmin ? () => openEditor('footer.aboutText', t.footer.aboutText) : undefined}
            onKeyDown={isAdmin ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                openEditor('footer.aboutText', t.footer.aboutText)
              }
            } : undefined}
            title={isAdmin ? t.adminInline.quickEdit : undefined}
          >
            {aboutText}
          </p>
        </div>

        <div>
          <h3 className="footer-title">{t.footer.quickLinks}</h3>
          <ul className="footer-links">
            <li><a href="/">{t.footer.home}</a></li>
            <li><a href="/cars">{t.footer.cars}</a></li>
            <li><a href="/opinions">{t.footer.opinions}</a></li>
            <li><a href="/reviews">{t.footer.reviews}</a></li>
          </ul>
        </div>

        <div>
          <h3 className="footer-title">{t.footer.contact}</h3>
          <p className="footer-muted">
            <span
              className={isAdmin ? 'review-inline-editable-block' : ''}
              role={isAdmin ? 'button' : undefined}
              tabIndex={isAdmin ? 0 : undefined}
              onClick={isAdmin ? () => openEditor('footer.email', t.footer.email) : undefined}
              onKeyDown={isAdmin ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openEditor('footer.email', t.footer.email)
                }
              } : undefined}
              title={isAdmin ? t.adminInline.quickEdit : undefined}
            >
              {contactEmail}
            </span>
            <br/>
            <span
              className={isAdmin ? 'review-inline-editable-block' : ''}
              role={isAdmin ? 'button' : undefined}
              tabIndex={isAdmin ? 0 : undefined}
              onClick={isAdmin ? () => openEditor('footer.phone', t.footer.phone) : undefined}
              onKeyDown={isAdmin ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openEditor('footer.phone', t.footer.phone)
                }
              } : undefined}
              title={isAdmin ? t.adminInline.quickEdit : undefined}
            >
              {contactPhone}
            </span>
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {currentYear} Auta Chin. {t.footer.rights}</p>
      </div>

      {isAdmin && editorField && (
        <div className="review-inline-editor-backdrop" onClick={closeEditor}>
          <div className="review-inline-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="review-inline-editor-title">{t.adminInline.quickEdit}</h3>
            <label className="form-label" htmlFor="footer-inline-editor-input">{editorField}</label>
            <textarea
              id="footer-inline-editor-input"
              className="form-input form-textarea"
              rows={4}
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
            />
            {editorMessage && <p className="form-success">{editorMessage}</p>}
            {editorError && <p className="form-error">{editorError}</p>}
            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={closeEditor}>{t.pages.cancelLabel}</button>
              <button type="button" className="btn btn-primary" disabled={editorSaving} onClick={handleSaveText}>
                {editorSaving ? t.pages.loading : t.adminInline.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  )
}
