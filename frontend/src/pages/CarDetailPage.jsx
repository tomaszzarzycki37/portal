import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link, useParams } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useTranslation } from '../i18n'
import api from '../services/api'
import { getCarImage, handleCarImageError } from '../utils/carImages'
import { canEditByAuthorId, isAdminUser, isAuthenticatedUser } from '../utils/auth'

const WORD_LIKE_MODULES = {
  toolbar: [
    [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['blockquote', 'code-block'],
    ['link', 'clean'],
  ],
}

const WORD_LIKE_FORMATS = [
  'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'align', 'list', 'bullet', 'indent',
  'blockquote', 'code-block',
  'link',
]

function sanitizeRichHtml(value) {
  return DOMPurify.sanitize(String(value || ''))
}

function decodeHtmlEntities(value) {
  if (!value) return ''
  const textarea = document.createElement('textarea')
  textarea.innerHTML = String(value)
  return textarea.value
}

function getMeaningfulRichText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function RichTextEditor({ id, label, value, onChange, placeholder }) {
  return (
    <div className="admin-rich-editor admin-rich-editor-compact">
      <label className="form-label" htmlFor={id}>{label}</label>
      <ReactQuill
        id={id}
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={WORD_LIKE_MODULES}
        formats={WORD_LIKE_FORMATS}
        placeholder={placeholder}
      />
    </div>
  )
}

function extractApiErrorMessage(error, fallbackMessage) {
  const payload = error?.response?.data
  if (!payload) return fallbackMessage

  if (typeof payload === 'string') return payload
  if (Array.isArray(payload)) {
    const joined = payload.map((item) => String(item || '').trim()).filter(Boolean).join(' ')
    return joined || fallbackMessage
  }

  if (typeof payload === 'object') {
    if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim()

    const messages = []
    Object.entries(payload).forEach(([field, value]) => {
      if (!value) return
      if (Array.isArray(value)) {
        const text = value.map((entry) => String(entry || '').trim()).filter(Boolean).join(' ')
        if (!text) return
        if (field === 'non_field_errors') messages.push(text)
        else messages.push(`${field}: ${text}`)
        return
      }

      const text = String(value).trim()
      if (!text) return
      if (field === 'non_field_errors') messages.push(text)
      else messages.push(`${field}: ${text}`)
    })

    if (messages.length > 0) return messages.join(' | ')
  }

  return fallbackMessage
}

function formatRatingDisplay(value) {
  const numeric = Number(value)
  const normalized = Number.isFinite(numeric) ? Math.min(5, Math.max(1, numeric)) : 5
  const rounded = Math.round(normalized)
  const stars = `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`
  const numericLabel = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1)
  return `${stars} (${numericLabel})`
}

export default function CarDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [car, setCar] = useState(null)
  const [opinions, setOpinions] = useState([])
  const [reviewArticles, setReviewArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [adminDescription, setAdminDescription] = useState('')
  const [adminYearIntroduced, setAdminYearIntroduced] = useState('')
  const [adminVehicleType, setAdminVehicleType] = useState('sedan')
  const [adminEngineType, setAdminEngineType] = useState('')
  const [adminHorsepower, setAdminHorsepower] = useState('')
  const [adminAcceleration, setAdminAcceleration] = useState('')
  const [adminTopSpeed, setAdminTopSpeed] = useState('')
  const [adminFuelConsumption, setAdminFuelConsumption] = useState('')
  const [adminPriceMin, setAdminPriceMin] = useState('')
  const [adminPriceMax, setAdminPriceMax] = useState('')
  const [adminCurrency, setAdminCurrency] = useState('CNY')
  const [adminProductionStatus, setAdminProductionStatus] = useState('active')
  const [adminFeatured, setAdminFeatured] = useState(false)
  const [adminImage, setAdminImage] = useState(null)
  const [isHeroImageEditorOpen, setIsHeroImageEditorOpen] = useState(false)
  const [heroImageSaving, setHeroImageSaving] = useState(false)
  const [heroImageMessage, setHeroImageMessage] = useState('')
  const [heroImageError, setHeroImageError] = useState('')
  const [adminOpinionTitle, setAdminOpinionTitle] = useState('')
  const [adminOpinionContent, setAdminOpinionContent] = useState('')
  const [adminOpinionRatingQuality, setAdminOpinionRatingQuality] = useState(5)
  const [adminOpinionRatingWorkmanship, setAdminOpinionRatingWorkmanship] = useState(5)
  const [adminOpinionRatingEconomy, setAdminOpinionRatingEconomy] = useState(5)
  const [adminOpinionRatingSafety, setAdminOpinionRatingSafety] = useState(5)
  const [adminOpinionRatingComfort, setAdminOpinionRatingComfort] = useState(5)
  const [adminOpinionRatingPerformance, setAdminOpinionRatingPerformance] = useState(5)
  const [adminOpinionRatingDesign, setAdminOpinionRatingDesign] = useState(5)
  const [adminOpinionRatingReliability, setAdminOpinionRatingReliability] = useState(5)
  const [adminOpinionSaving, setAdminOpinionSaving] = useState(false)
  const [adminOpinionMessage, setAdminOpinionMessage] = useState('')
  const [adminOpinionError, setAdminOpinionError] = useState('')
  const [editingOpinionId, setEditingOpinionId] = useState(null)
  const [editingOpinionDraft, setEditingOpinionDraft] = useState(null)
  const [opinionActionLoading, setOpinionActionLoading] = useState(false)
  const [expandedOpinions, setExpandedOpinions] = useState(new Set())
  const [opinionComments, setOpinionComments] = useState({})
  const [commentTexts, setCommentTexts] = useState({})
  const [commentSaving, setCommentSaving] = useState({})
  const [voteSaving, setVoteSaving] = useState({})
  const [reviewSlideIndex, setReviewSlideIndex] = useState(0)
  const [opinionSlideIndex, setOpinionSlideIndex] = useState(0)
  const [isAddOpinionOpen, setIsAddOpinionOpen] = useState(false)
  const [isAdminDetailEditorOpen, setIsAdminDetailEditorOpen] = useState(false)
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  const [adminError, setAdminError] = useState('')
  const isAdmin = isAdminUser()
  const isLoggedIn = isAuthenticatedUser()
  const opinionRatingCategories = [
    { key: 'rating_quality', label: t.pages.ratingQuality },
    { key: 'rating_workmanship', label: t.pages.ratingWorkmanship },
    { key: 'rating_economy', label: t.pages.ratingEconomy },
    { key: 'rating_safety', label: t.pages.ratingSafety },
    { key: 'rating_comfort', label: t.pages.ratingComfort },
    { key: 'rating_performance', label: t.pages.ratingPerformance },
    { key: 'rating_design', label: t.pages.ratingDesign },
    { key: 'rating_reliability', label: t.pages.ratingReliability },
  ]

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const [carResponse, opinionsResponse, reviewsResponse] = await Promise.all([
          api.get(`/cars/${id}/`),
          api.get(`/opinions/?car_model=${id}&ordering=-created_at`),
          api.get(`/reviews/?car_model=${id}&ordering=-published_at&page_size=3`),
        ])

        setCar(carResponse.data)
        setOpinions(opinionsResponse.data.results || opinionsResponse.data)
        setReviewArticles(reviewsResponse.data.results || reviewsResponse.data || [])

        if (isAdmin) {
          setAdminDescription(carResponse.data.description || '')
          setAdminYearIntroduced(carResponse.data.year_introduced ? String(carResponse.data.year_introduced) : '')
          setAdminVehicleType(carResponse.data.vehicle_type || 'sedan')
          setAdminEngineType(carResponse.data.engine_type || '')
          setAdminHorsepower(
            carResponse.data.horsepower !== null && carResponse.data.horsepower !== undefined
              ? String(carResponse.data.horsepower)
              : '',
          )
          setAdminAcceleration(carResponse.data.acceleration || '')
          setAdminTopSpeed(
            carResponse.data.top_speed !== null && carResponse.data.top_speed !== undefined
              ? String(carResponse.data.top_speed)
              : '',
          )
          setAdminFuelConsumption(carResponse.data.fuel_consumption || '')
          setAdminPriceMin(carResponse.data.price_min ? String(carResponse.data.price_min) : '')
          setAdminPriceMax(carResponse.data.price_max ? String(carResponse.data.price_max) : '')
          setAdminCurrency(carResponse.data.currency || 'CNY')
          setAdminProductionStatus(carResponse.data.production_status || 'active')
          setAdminFeatured(!!carResponse.data.is_featured)
        }
      } catch (error) {
        console.error('Error fetching car details:', error)
        setCar(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, isAdmin])

  useEffect(() => {
    if (reviewArticles.length === 0) {
      setReviewSlideIndex(0)
      return
    }
    if (reviewSlideIndex >= reviewArticles.length) {
      setReviewSlideIndex(0)
    }
  }, [reviewArticles, reviewSlideIndex])

  useEffect(() => {
    const visibleOpinionsCount = Math.min(opinions.length, 10)
    if (visibleOpinionsCount === 0) {
      setOpinionSlideIndex(0)
      return
    }
    if (opinionSlideIndex >= visibleOpinionsCount) {
      setOpinionSlideIndex(0)
    }
  }, [opinions, opinionSlideIndex])

  const handleToggleComments = async (opinionId) => {
    setExpandedOpinions((prev) => {
      const next = new Set(prev)
      if (next.has(opinionId)) {
        next.delete(opinionId)
      } else {
        next.add(opinionId)
      }
      return next
    })
    if (!opinionComments[opinionId]) {
      try {
        const res = await api.get(`/opinions/${opinionId}/`)
        setOpinionComments((prev) => ({ ...prev, [opinionId]: res.data.comments || [] }))
      } catch {
        setOpinionComments((prev) => ({ ...prev, [opinionId]: [] }))
      }
    }
  }

  const handleAddComment = async (opinionId) => {
    const text = (commentTexts[opinionId] || '').trim()
    if (!text) return
    setCommentSaving((prev) => ({ ...prev, [opinionId]: true }))
    try {
      await api.post(`/opinions/${opinionId}/add_comment/`, { content: text })
      const res = await api.get(`/opinions/${opinionId}/`)
      setOpinionComments((prev) => ({ ...prev, [opinionId]: res.data.comments || [] }))
      setCommentTexts((prev) => ({ ...prev, [opinionId]: '' }))
    } catch {
      // comment error silently ignored — form stays open
    } finally {
      setCommentSaving((prev) => ({ ...prev, [opinionId]: false }))
    }
  }

  const handleAdminSave = async (e) => {
    e.preventDefault()
    if (!isAdmin) return

    try {
      setAdminSaving(true)
      setAdminMessage('')
      setAdminError('')

      const toIntOrNull = (value) => {
        const trimmed = String(value || '').trim()
        if (!trimmed) return null
        const parsed = Number.parseInt(trimmed, 10)
        return Number.isNaN(parsed) ? null : parsed
      }

      const formData = new FormData()
      formData.append('description', adminDescription)
      formData.append('year_introduced', adminYearIntroduced)
      formData.append('vehicle_type', adminVehicleType)
      formData.append('engine_type', adminEngineType)
      formData.append('horsepower', String(toIntOrNull(adminHorsepower) ?? ''))
      formData.append('acceleration', adminAcceleration)
      formData.append('top_speed', String(toIntOrNull(adminTopSpeed) ?? ''))
      formData.append('fuel_consumption', adminFuelConsumption)
      formData.append('price_min', adminPriceMin ? parseFloat(adminPriceMin) : '')
      formData.append('price_max', adminPriceMax ? parseFloat(adminPriceMax) : '')
      formData.append('currency', adminCurrency)
      formData.append('production_status', adminProductionStatus)
      formData.append('is_featured', String(adminFeatured))
      if (adminImage) {
        formData.append('image', adminImage)
      }

      const response = await api.patch(`/cars/${id}/`, formData)

      setCar(response.data)
      setAdminImage(null)
      setAdminMessage(t.adminInline.saved)
    } catch (error) {
      setAdminError(extractApiErrorMessage(error, t.adminInline.saveError))
    } finally {
      setAdminSaving(false)
    }
  }

  const handleHeroImageSave = async () => {
    if (!isAdmin || !adminImage) return

    try {
      setHeroImageSaving(true)
      setHeroImageMessage('')
      setHeroImageError('')

      const formData = new FormData()
      formData.append('image', adminImage)

      const response = await api.patch(`/cars/${id}/`, formData)
      setCar(response.data)
      setAdminImage(null)
      setHeroImageMessage(t.adminInline.saved)
    } catch (error) {
      setHeroImageError(extractApiErrorMessage(error, t.adminInline.saveError))
    } finally {
      setHeroImageSaving(false)
    }
  }

  const handleAdminOpinionCreate = async (e) => {
    e.preventDefault()
    if (!isLoggedIn || !car) return

    const trimmedTitle = String(adminOpinionTitle || '').trim()
    const trimmedContent = String(adminOpinionContent || '').trim()

    if (!trimmedTitle || !getMeaningfulRichText(trimmedContent)) {
      setAdminOpinionMessage('')
      setAdminOpinionError(t.pages.opinionCreateValidation)
      return
    }

    try {
      setAdminOpinionSaving(true)
      setAdminOpinionMessage('')
      setAdminOpinionError('')

      await api.post('/opinions/', {
        car_model: car.id,
        title: trimmedTitle,
        content: trimmedContent,
        rating_quality: adminOpinionRatingQuality,
        rating_workmanship: adminOpinionRatingWorkmanship,
        rating_economy: adminOpinionRatingEconomy,
        rating_safety: adminOpinionRatingSafety,
        rating_comfort: adminOpinionRatingComfort,
        rating_performance: adminOpinionRatingPerformance,
        rating_design: adminOpinionRatingDesign,
        rating_reliability: adminOpinionRatingReliability,
      })

      const [carResponse, opinionsResponse] = await Promise.all([
        api.get(`/cars/${id}/`),
        api.get(`/opinions/?car_model=${id}&ordering=-created_at`),
      ])
      setCar(carResponse.data)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)

      setAdminOpinionTitle('')
      setAdminOpinionContent('')
      setAdminOpinionRatingQuality(5)
      setAdminOpinionRatingWorkmanship(5)
      setAdminOpinionRatingEconomy(5)
      setAdminOpinionRatingSafety(5)
      setAdminOpinionRatingComfort(5)
      setAdminOpinionRatingPerformance(5)
      setAdminOpinionRatingDesign(5)
      setAdminOpinionRatingReliability(5)
      setAdminOpinionMessage(t.pages.opinionCreated)
    } catch {
      setAdminOpinionError(t.pages.opinionCreateError)
    } finally {
      setAdminOpinionSaving(false)
    }
  }

  const handleStartOpinionEdit = (opinion) => {
    setEditingOpinionId(opinion.id)
    setEditingOpinionDraft({
      title: opinion.title || '',
      content: opinion.content || '',
      rating_quality: opinion.rating_quality || 5,
      rating_workmanship: opinion.rating_workmanship || 5,
      rating_economy: opinion.rating_economy || 5,
      rating_safety: opinion.rating_safety || 5,
      rating_comfort: opinion.rating_comfort || 5,
      rating_performance: opinion.rating_performance || 5,
      rating_design: opinion.rating_design || 5,
      rating_reliability: opinion.rating_reliability || 5,
    })
    setAdminOpinionMessage('')
    setAdminOpinionError('')
  }

  const handleSaveOpinionEdit = async (opinionId) => {
    if (!editingOpinionDraft || !car) return
    const trimmedTitle = String(editingOpinionDraft.title || '').trim()
    const trimmedContent = String(editingOpinionDraft.content || '').trim()

    if (!trimmedTitle || !getMeaningfulRichText(trimmedContent)) {
      setAdminOpinionError(t.pages.opinionCreateValidation)
      return
    }

    try {
      setOpinionActionLoading(true)
      setAdminOpinionMessage('')
      setAdminOpinionError('')
      await api.patch(`/opinions/${opinionId}/`, {
        car_model: car.id,
        title: trimmedTitle,
        content: trimmedContent,
        rating_quality: editingOpinionDraft.rating_quality || 5,
        rating_workmanship: editingOpinionDraft.rating_workmanship || 5,
        rating_economy: editingOpinionDraft.rating_economy || 5,
        rating_safety: editingOpinionDraft.rating_safety || 5,
        rating_comfort: editingOpinionDraft.rating_comfort || 5,
        rating_performance: editingOpinionDraft.rating_performance || 5,
        rating_design: editingOpinionDraft.rating_design || 5,
        rating_reliability: editingOpinionDraft.rating_reliability || 5,
      })

      const opinionsResponse = await api.get(`/opinions/?car_model=${id}&ordering=-created_at`)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)
      setEditingOpinionId(null)
      setEditingOpinionDraft(null)
      setAdminOpinionMessage(t.pages.opinionUpdated)
    } catch {
      setAdminOpinionError(t.pages.opinionUpdateError)
    } finally {
      setOpinionActionLoading(false)
    }
  }

  const handleDeleteOpinion = async (opinionId) => {
    if (!window.confirm(t.pages.opinionDeleteConfirm)) return
    try {
      setOpinionActionLoading(true)
      setAdminOpinionMessage('')
      setAdminOpinionError('')
      await api.delete(`/opinions/${opinionId}/`)
      const opinionsResponse = await api.get(`/opinions/?car_model=${id}&ordering=-created_at`)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)
      if (editingOpinionId === opinionId) {
        setEditingOpinionId(null)
        setEditingOpinionDraft(null)
      }
      setAdminOpinionMessage(t.pages.opinionDeleted)
    } catch {
      setAdminOpinionError(t.pages.opinionDeleteError)
    } finally {
      setOpinionActionLoading(false)
    }
  }

  const handleVoteOpinion = async (opinionId, voteType) => {
    if (!['helpful', 'unhelpful'].includes(voteType)) return
    if (!isLoggedIn) {
      setAdminOpinionError(t.pages.loginToContribute)
      return
    }

    try {
      setVoteSaving((prev) => ({ ...prev, [opinionId]: true }))
      setAdminOpinionError('')
      setAdminOpinionMessage('')
      await api.post(`/opinions/${opinionId}/vote/`, { vote_type: voteType })
      const opinionsResponse = await api.get(`/opinions/?car_model=${id}&ordering=-created_at`)
      setOpinions(opinionsResponse.data.results || opinionsResponse.data)
    } catch {
      setAdminOpinionError(t.pages.opinionUpdateError)
    } finally {
      setVoteSaving((prev) => ({ ...prev, [opinionId]: false }))
    }
  }

  if (loading) {
    return <div className="page-loading">{t.pages.loading}</div>
  }

  if (!car) {
    return <div className="page-card">{t.pages.carNotFound}</div>
  }

  const currentYear = new Date().getFullYear()
  const modelAge = car.year_introduced ? Math.max(currentYear - car.year_introduced, 0) : null
  const latestOpinions = opinions.slice(0, 10)
  const activeOpinion = latestOpinions[opinionSlideIndex] || null
  const activeReview = reviewArticles[reviewSlideIndex] || null

  return (
    <div className="detail-wrap">
      <nav className="breadcrumbs" aria-label={t.pages.breadcrumbsLabel}>
        <Link to="/" className="breadcrumbs-link">{t.footer.home}</Link>
        <span className="breadcrumbs-separator">/</span>
        <Link to="/cars" className="breadcrumbs-link">{t.nav.cars}</Link>
        {car.brand?.slug && (
          <>
            <span className="breadcrumbs-separator">/</span>
            <Link to={`/cars/brands/${car.brand.slug}`} className="breadcrumbs-link">{car.brand.name}</Link>
          </>
        )}
        <span className="breadcrumbs-separator">/</span>
        <span className="breadcrumbs-current">{car.name}</span>
      </nav>

      <section className="detail-hero">
        <div className="detail-copy">
          <p className="detail-kicker">{car.brand?.name || ''}</p>
          <h1 className="page-title detail-title">{car.name}</h1>
          <p className="detail-description">{car.description}</p>

          <div className="detail-badges">
            <span className="detail-badge">{car.vehicle_type}</span>
            <span className="detail-badge">{car.year_introduced}</span>
            <span className="detail-badge">{car.production_status}</span>
          </div>

          <div className="detail-shortcuts-row">
            <Link to={`/cars/${car.id}/reviews`} className="btn btn-primary btn-sm">
              {t.pages.reviewsSectionTitle}
            </Link>
            {isAdmin && (
              <button
                type="button"
                className={`admin-inline-toggle admin-inline-gear ${isHeroImageEditorOpen ? 'is-open' : ''}`}
                onClick={() => setIsHeroImageEditorOpen((prev) => !prev)}
                aria-expanded={isHeroImageEditorOpen}
                aria-label={isHeroImageEditorOpen ? t.adminPanel.hideImageEditor : t.adminPanel.editImage}
                title={isHeroImageEditorOpen ? t.adminPanel.hideImageEditor : t.adminPanel.editImage}
              >
                <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                </svg>
              </button>
            )}
          </div>

          {isAdmin && isHeroImageEditorOpen && (
            <div style={{ marginTop: '0.55rem', display: 'grid', gap: '0.5rem' }}>
              <div className="admin-file-picker-row">
                <input
                  id="hero-image"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    setAdminImage(e.target.files?.[0] || null)
                    setHeroImageMessage('')
                    setHeroImageError('')
                  }}
                />
                <label htmlFor="hero-image" className="btn btn-secondary btn-sm">{t.adminInline.chooseFile}</label>
                <span className="admin-file-picker-name">{adminImage ? adminImage.name : t.adminInline.noFileSelected}</span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!adminImage || heroImageSaving}
                  onClick={handleHeroImageSave}
                >
                  {heroImageSaving ? t.pages.loading : t.adminInline.save}
                </button>
              </div>
              {heroImageMessage && <p className="form-success">{heroImageMessage}</p>}
              {heroImageError && <p className="form-error">{heroImageError}</p>}
            </div>
          )}
        </div>

        <img src={getCarImage(car)} alt={car.name} className="detail-image" onError={handleCarImageError} />
      </section>

      <section className="detail-specs-card">
        <h2 className="detail-section-title">{t.pages.specs}</h2>
        <div className="detail-specs-grid">
          <div className="spec-item"><span>{t.pages.year}</span><strong>{car.year_introduced || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.type}</span><strong>{car.vehicle_type || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.engine}</span><strong>{car.engine_type || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.horsepower}</span><strong>{car.horsepower || '-'} hp</strong></div>
          <div className="spec-item"><span>{t.pages.acceleration}</span><strong>{car.acceleration || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.topSpeed}</span><strong>{car.top_speed || '-'} km/h</strong></div>
          <div className="spec-item"><span>{t.pages.fuelConsumption}</span><strong>{car.fuel_consumption || '-'}</strong></div>
          <div className="spec-item"><span>{t.pages.price}</span><strong>{car.price_range_display || '-'}</strong></div>
        </div>
      </section>

      <section className="detail-extra-grid">
        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionPerformance}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.horsepower}</span>
              <strong>{car.horsepower || '-'} hp</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.acceleration}</span>
              <strong>{car.acceleration || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.topSpeed}</span>
              <strong>{car.top_speed || '-'} km/h</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.fuelConsumption}</span>
              <strong>{car.fuel_consumption || '-'}</strong>
            </div>
          </div>
        </article>

        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionMarket}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.price}</span>
              <strong>{car.price_range_display || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.productionStatus}</span>
              <strong>{car.production_status || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.modelAge}</span>
              <strong>{modelAge !== null ? `${modelAge} ${t.pages.years}` : '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.featuredModel}</span>
              <strong>{car.is_featured ? t.pages.yes : t.pages.no}</strong>
            </div>
          </div>
        </article>

        <article className="detail-extra-card">
          <h3 className="detail-extra-title">{t.pages.sectionCommunity}</h3>
          <div className="detail-kv-list">
            <div className="detail-kv-row">
              <span>{t.pages.brandLabel}</span>
              <strong>{car.brand?.name || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.type}</span>
              <strong>{car.vehicle_type || '-'}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.averageRating}</span>
              <strong>{car.avg_rating || 0}</strong>
            </div>
            <div className="detail-kv-row">
              <span>{t.pages.totalOpinions}</span>
              <strong>{car.opinions_count || 0}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="detail-reviews-card">
        <div className="detail-section-header">
          <div>
            <h2 className="detail-section-title">{t.pages.reviewsSectionTitle}</h2>
            <p className="detail-section-subtitle">{t.pages.reviewsSectionIntro}</p>
          </div>
          <Link to={`/cars/${car.id}/reviews`} className="btn btn-primary btn-sm">
            {t.pages.openReviewsPage}
          </Link>
        </div>

        {reviewArticles.length === 0 ? (
          <div className="page-card">{t.pages.noReviewsYet}</div>
        ) : (
          <div>
            {activeReview && (
              <article className="opinion-card-item" style={{ marginBottom: '0.75rem' }}>
                {isAdmin && (
                  <Link
                    to={`/admin?section=manage-reviews&editReview=${activeReview.id}`}
                    className="review-admin-quick-edit"
                    aria-label={t.adminPanel.editReview || 'Edit review'}
                    title={t.adminPanel.editReview || 'Edit review'}
                  >
                    <svg className="review-admin-quick-edit-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                    </svg>
                  </Link>
                )}
                <h3 className="opinion-title">{activeReview.title}</h3>
                <p className="opinion-meta">
                  {activeReview.publication_name}
                  {activeReview.author_name ? ` - ${activeReview.author_name}` : ''}
                </p>
                <div
                  className="opinion-text"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(decodeHtmlEntities(activeReview.summary || activeReview.content)) }}
                />
              </article>
            )}

            {reviewArticles.length > 1 && (
              <div className="admin-actions-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setReviewSlideIndex((prev) => (prev - 1 + reviewArticles.length) % reviewArticles.length)}
                >
                  ‹
                </button>
                <span className="admin-meta">{reviewSlideIndex + 1}/{reviewArticles.length}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setReviewSlideIndex((prev) => (prev + 1) % reviewArticles.length)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="detail-opinions">
        <div className="detail-section-header" style={{ marginBottom: '0.9rem' }}>
          <h2 className="detail-section-title">{t.pages.carOpinions}</h2>
          {latestOpinions.length > 1 && (
            <div className="admin-actions-row" style={{ margin: 0 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setOpinionSlideIndex((prev) => (prev - 1 + latestOpinions.length) % latestOpinions.length)}
              >
                ‹
              </button>
              <span className="admin-meta">{opinionSlideIndex + 1}/{latestOpinions.length}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setOpinionSlideIndex((prev) => (prev + 1) % latestOpinions.length)}
              >
                ›
              </button>
            </div>
          )}
        </div>

        {isLoggedIn ? (
          <div className="admin-form-card" style={{ marginBottom: '1.1rem' }}>
            <div className="detail-section-header detail-collapsible-header" style={{ marginBottom: isAddOpinionOpen ? '0.9rem' : 0 }}>
              <span style={{ fontWeight: 700 }}>{t.pages.addOpinionTitle}</span>
              <button
                type="button"
                className={`admin-inline-toggle admin-inline-gear ${isAddOpinionOpen ? 'is-open' : ''}`}
                onClick={() => setIsAddOpinionOpen((prev) => !prev)}
                aria-expanded={isAddOpinionOpen}
                aria-label={t.pages.addOpinionTitle}
                title={t.pages.addOpinionTitle}
              >
                <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                </svg>
              </button>
            </div>

            {isAddOpinionOpen && (
              <form onSubmit={handleAdminOpinionCreate}>
                <label className="form-label" htmlFor="admin-opinion-title">{t.pages.opinionTitle}</label>
                <input
                  id="admin-opinion-title"
                  className="form-input"
                  value={adminOpinionTitle}
                  onChange={(e) => setAdminOpinionTitle(e.target.value)}
                />

                <RichTextEditor
                  id="admin-opinion-content"
                  label={t.adminPanel.description}
                  value={adminOpinionContent}
                  onChange={setAdminOpinionContent}
                  placeholder={t.adminPanel.reviewEditorPlaceholder}
                />

                <label className="form-label" htmlFor="admin-opinion-rating">{t.pages.averageRating}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">{t.pages.ratingQuality}</label>
                    <select className="form-input" value={adminOpinionRatingQuality} onChange={(e) => setAdminOpinionRatingQuality(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{t.pages.ratingWorkmanship}</label>
                    <select className="form-input" value={adminOpinionRatingWorkmanship} onChange={(e) => setAdminOpinionRatingWorkmanship(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{t.pages.ratingEconomy}</label>
                    <select className="form-input" value={adminOpinionRatingEconomy} onChange={(e) => setAdminOpinionRatingEconomy(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{t.pages.ratingSafety}</label>
                    <select className="form-input" value={adminOpinionRatingSafety} onChange={(e) => setAdminOpinionRatingSafety(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{t.pages.ratingComfort}</label>
                    <select className="form-input" value={adminOpinionRatingComfort} onChange={(e) => setAdminOpinionRatingComfort(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{t.pages.ratingPerformance}</label>
                    <select className="form-input" value={adminOpinionRatingPerformance} onChange={(e) => setAdminOpinionRatingPerformance(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{t.pages.ratingDesign}</label>
                    <select className="form-input" value={adminOpinionRatingDesign} onChange={(e) => setAdminOpinionRatingDesign(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{t.pages.ratingReliability}</label>
                    <select className="form-input" value={adminOpinionRatingReliability} onChange={(e) => setAdminOpinionRatingReliability(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={adminOpinionSaving}>
                  {adminOpinionSaving ? t.pages.loading : t.pages.addOpinionSubmit}
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="admin-subtitle">{t.pages.loginToContribute}</p>
        )}

        {adminOpinionMessage && <p className="form-success">{adminOpinionMessage}</p>}
        {adminOpinionError && <p className="form-error">{adminOpinionError}</p>}

        {latestOpinions.length === 0 ? (
          <div className="page-card">{t.pages.noOpinions}</div>
        ) : (
          <div className="opinions-grid">
            {activeOpinion && (
              <article key={activeOpinion.id} className="opinion-card-item">
                {editingOpinionId === activeOpinion.id && editingOpinionDraft ? (
                  <div className="admin-form-card" style={{ marginBottom: '0.5rem' }}>
                    <label className="form-label">{t.pages.opinionTitle}</label>
                    <input
                      className="form-input"
                      value={editingOpinionDraft.title}
                      onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    <RichTextEditor
                      id={`edit-opinion-content-${opinion.id}`}
                      label={t.adminPanel.description}
                      value={editingOpinionDraft.content}
                      onChange={(nextValue) => setEditingOpinionDraft((prev) => ({ ...prev, content: nextValue }))}
                      placeholder={t.adminPanel.reviewEditorPlaceholder}
                    />
                    <label className="form-label">{t.pages.averageRating}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label className="form-label">{t.pages.ratingQuality}</label>
                        <select className="form-input" value={editingOpinionDraft.rating_quality} onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating_quality: Number(e.target.value) }))}>
                          <option value={5}>5</option>
                          <option value={4}>4</option>
                          <option value={3}>3</option>
                          <option value={2}>2</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">{t.pages.ratingWorkmanship}</label>
                        <select className="form-input" value={editingOpinionDraft.rating_workmanship} onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating_workmanship: Number(e.target.value) }))}>
                          <option value={5}>5</option>
                          <option value={4}>4</option>
                          <option value={3}>3</option>
                          <option value={2}>2</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">{t.pages.ratingEconomy}</label>
                        <select className="form-input" value={editingOpinionDraft.rating_economy} onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating_economy: Number(e.target.value) }))}>
                          <option value={5}>5</option>
                          <option value={4}>4</option>
                          <option value={3}>3</option>
                          <option value={2}>2</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">{t.pages.ratingSafety}</label>
                        <select className="form-input" value={editingOpinionDraft.rating_safety} onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating_safety: Number(e.target.value) }))}>
                          <option value={5}>5</option>
                          <option value={4}>4</option>
                          <option value={3}>3</option>
                          <option value={2}>2</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">{t.pages.ratingComfort}</label>
                        <select className="form-input" value={editingOpinionDraft.rating_comfort} onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating_comfort: Number(e.target.value) }))}>
                          <option value={5}>5</option>
                          <option value={4}>4</option>
                          <option value={3}>3</option>
                          <option value={2}>2</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">{t.pages.ratingPerformance}</label>
                        <select className="form-input" value={editingOpinionDraft.rating_performance} onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating_performance: Number(e.target.value) }))}>
                          <option value={5}>5</option>
                          <option value={4}>4</option>
                          <option value={3}>3</option>
                          <option value={2}>2</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">{t.pages.ratingDesign}</label>
                        <select className="form-input" value={editingOpinionDraft.rating_design} onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating_design: Number(e.target.value) }))}>
                          <option value={5}>5</option>
                          <option value={4}>4</option>
                          <option value={3}>3</option>
                          <option value={2}>2</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">{t.pages.ratingReliability}</label>
                        <select className="form-input" value={editingOpinionDraft.rating_reliability} onChange={(e) => setEditingOpinionDraft((prev) => ({ ...prev, rating_reliability: Number(e.target.value) }))}>
                          <option value={5}>5</option>
                          <option value={4}>4</option>
                          <option value={3}>3</option>
                          <option value={2}>2</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                    </div>
                    <div className="admin-actions-row">
                      <button type="button" className="btn btn-secondary" onClick={() => { setEditingOpinionId(null); setEditingOpinionDraft(null) }}>
                        {t.pages.cancelLabel}
                      </button>
                      <button type="button" className="btn btn-primary" disabled={opinionActionLoading} onClick={() => handleSaveOpinionEdit(opinion.id)}>
                        {opinionActionLoading ? t.pages.loading : t.pages.saveLabel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="opinion-title">{activeOpinion.title}</h3>
                    <p className="opinion-meta">{activeOpinion.author?.username || 'user'}</p>
                    <div
                      className="opinion-text"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(activeOpinion.content) }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      {opinionRatingCategories.map((category) => (
                        <div key={category.key} className="opinion-category-rating">
                          <span style={{ fontSize: '0.85rem', color: '#666' }}>{category.label}</span>
                          <span className="rating" style={{ fontSize: '0.95rem' }}>{formatRatingDisplay(activeOpinion[category.key])}</span>
                        </div>
                      ))}
                    </div>
                    <div className="opinion-rating-row">
                      <div className="opinion-votes" role="group" aria-label="Opinion votes">
                        <button
                          type="button"
                          className="opinion-vote-btn"
                          disabled={!!voteSaving[activeOpinion.id]}
                          onClick={() => handleVoteOpinion(activeOpinion.id, 'helpful')}
                          title="Helpful"
                        >
                          👍 {activeOpinion.helpful_count}
                        </button>
                        <span className="opinion-vote-separator">|</span>
                        <button
                          type="button"
                          className="opinion-vote-btn"
                          disabled={!!voteSaving[activeOpinion.id]}
                          onClick={() => handleVoteOpinion(activeOpinion.id, 'unhelpful')}
                          title="Unhelpful"
                        >
                          👎 {activeOpinion.unhelpful_count}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn-comment-toggle"
                        onClick={() => handleToggleComments(activeOpinion.id)}
                      >
                        {expandedOpinions.has(activeOpinion.id) ? '−' : '+'} {activeOpinion.comments_count || 0} {t.pages.showComments}
                      </button>
                    </div>
                  </>
                )}
                {canEditByAuthorId(activeOpinion.author?.id) && editingOpinionId !== activeOpinion.id && (
                  <div className="admin-actions-row" style={{ marginTop: '0.4rem' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleStartOpinionEdit(activeOpinion)}>
                      {t.pages.editLabel}
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteOpinion(activeOpinion.id)}>
                      {t.pages.deleteLabel}
                    </button>
                  </div>
                )}
                {expandedOpinions.has(activeOpinion.id) && (
                  <div className="opinion-comments">
                    {(opinionComments[activeOpinion.id] || []).length === 0 ? (
                      <p className="opinion-no-comments">{t.pages.noComments}</p>
                    ) : (
                      (opinionComments[activeOpinion.id] || []).map((c) => (
                        <div key={c.id} className="comment-item">
                          <span className="comment-author">{c.author?.username}</span>
                          <span className="comment-text">{c.content}</span>
                        </div>
                      ))
                    )}
                    <div className="comment-add-row">
                      {isLoggedIn ? (
                        <>
                          <input
                            className="form-input comment-input"
                            placeholder={t.pages.commentPlaceholder}
                            value={commentTexts[activeOpinion.id] || ''}
                            onChange={(e) =>
                              setCommentTexts((prev) => ({ ...prev, [activeOpinion.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddComment(activeOpinion.id)
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={commentSaving[activeOpinion.id]}
                            onClick={() => handleAddComment(activeOpinion.id)}
                          >
                            {t.pages.commentSubmit}
                          </button>
                        </>
                      ) : (
                        <p className="admin-meta">{t.pages.loginToContribute}</p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            )}
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="detail-admin-card">
          <div className="detail-section-header detail-collapsible-header" style={{ marginBottom: '0.75rem' }}>
            <h2 className="detail-section-title">{t.adminInline.detailEditor}</h2>
            <button
              type="button"
              className={`admin-inline-toggle admin-inline-gear ${isAdminDetailEditorOpen ? 'is-open' : ''}`}
              onClick={() => setIsAdminDetailEditorOpen((prev) => !prev)}
              aria-expanded={isAdminDetailEditorOpen}
              aria-label={t.adminInline.detailEditor}
              title={t.adminInline.detailEditor}
            >
              <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
              </svg>
            </button>
          </div>
          {isAdminDetailEditorOpen && (
          <form className="admin-form-card" onSubmit={handleAdminSave}>
            <div className="admin-fields-grid">
              <div>
                <label className="form-label" htmlFor="admin-year">{t.pages.year}</label>
                <input
                  id="admin-year"
                  type="number"
                  className="form-input"
                  value={adminYearIntroduced}
                  onChange={(e) => setAdminYearIntroduced(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-type">{t.pages.type}</label>
                <select
                  id="admin-type"
                  className="form-input"
                  value={adminVehicleType}
                  onChange={(e) => setAdminVehicleType(e.target.value)}
                >
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="crossover">Crossover</option>
                  <option value="hatchback">Hatchback</option>
                  <option value="coupe">Coupe</option>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <label className="form-label" htmlFor="admin-description">{t.adminPanel.description}</label>
            <textarea
              id="admin-description"
              className="form-input form-textarea"
              value={adminDescription}
              onChange={(e) => setAdminDescription(e.target.value)}
              rows={4}
            />

            <div className="admin-fields-grid">
              <div>
                <label className="form-label" htmlFor="admin-engine">{t.pages.engine}</label>
                <input
                  id="admin-engine"
                  className="form-input"
                  value={adminEngineType}
                  onChange={(e) => setAdminEngineType(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-hp">{t.pages.horsepower}</label>
                <input
                  id="admin-hp"
                  type="number"
                  className="form-input"
                  value={adminHorsepower}
                  onChange={(e) => setAdminHorsepower(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-acc">{t.pages.acceleration}</label>
                <input
                  id="admin-acc"
                  className="form-input"
                  value={adminAcceleration}
                  onChange={(e) => setAdminAcceleration(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-top">{t.pages.topSpeed}</label>
                <input
                  id="admin-top"
                  type="number"
                  className="form-input"
                  value={adminTopSpeed}
                  onChange={(e) => setAdminTopSpeed(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-consumption">{t.pages.fuelConsumption}</label>
                <input
                  id="admin-consumption"
                  className="form-input"
                  value={adminFuelConsumption}
                  onChange={(e) => setAdminFuelConsumption(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="admin-status">{t.pages.productionStatus}</label>
                <select
                  id="admin-status"
                  className="form-input"
                  value={adminProductionStatus}
                  onChange={(e) => setAdminProductionStatus(e.target.value)}
                >
                  <option value="active">{t.pages.statusActive}</option>
                  <option value="discontinued">{t.pages.statusDiscontinued}</option>
                  <option value="upcoming">{t.pages.statusUpcoming}</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label" htmlFor="admin-price-min">{t.adminPanel.priceMinK}</label>
                <input
                  id="admin-price-min"
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={adminPriceMin}
                  onChange={(e) => setAdminPriceMin(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="admin-price-max">{t.adminPanel.priceMaxK}</label>
                <input
                  id="admin-price-max"
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={adminPriceMax}
                  onChange={(e) => setAdminPriceMax(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="admin-currency">{t.adminPanel.baseCurrency}</label>
                <select
                  id="admin-currency"
                  className="form-input"
                  value={adminCurrency}
                  onChange={(e) => setAdminCurrency(e.target.value)}
                >
                  <option value="CNY">¥ CNY</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                  <option value="GBP">£ GBP</option>
                  <option value="JPY">¥ JPY</option>
                  <option value="PLN">zł PLN</option>
                  <option value="INR">₹ INR</option>
                </select>
              </div>
            </div>

            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={adminFeatured}
                onChange={(e) => setAdminFeatured(e.target.checked)}
              />
              {t.adminPanel.featured}
            </label>

            <label className="form-label" htmlFor="admin-image">{t.adminPanel.image}</label>
            <div className="admin-file-picker-row">
              <input
                id="admin-image"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => setAdminImage(e.target.files?.[0] || null)}
              />
              <label htmlFor="admin-image" className="btn btn-secondary btn-sm">{t.adminInline.chooseFile}</label>
              <span className="admin-file-picker-name">{adminImage ? adminImage.name : t.adminInline.noFileSelected}</span>
            </div>

            {adminMessage && <p className="form-success">{adminMessage}</p>}
            {adminError && <p className="form-error">{adminError}</p>}

            <button type="submit" className="btn btn-primary" disabled={adminSaving}>
              {adminSaving ? t.pages.loading : t.adminInline.save}
            </button>
          </form>
          )}
        </section>
      )}
    </div>
  )
}
